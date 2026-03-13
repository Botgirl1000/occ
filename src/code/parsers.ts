import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { getLanguageSpec, getModuleName, isLocalSpecifier, normalizePath, resolveLocalImport, resolvePythonImport } from './languages.js';
import type {
  ParsedCall,
  ParsedFile,
  ParsedImport,
  ParsedImportBinding,
  ParsedInheritance,
  ParsedSymbol,
} from './types.js';

interface ParserContext {
  repoRoot: string;
}

const PYTHON_STDLIB_MODULES = new Set([
  'abc', 'argparse', 'asyncio', 'base64', 'collections', 'contextlib', 'csv',
  'dataclasses', 'datetime', 'functools', 'glob', 'hashlib', 'heapq', 'inspect',
  'itertools', 'json', 'logging', 'math', 'os', 'pathlib', 'queue', 'random',
  're', 'shutil', 'statistics', 'string', 'subprocess', 'sys', 'tempfile',
  'threading', 'time', 'typing', 'unittest', 'uuid',
]);

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function propertyName(node: ts.PropertyName | ts.BindingName | ts.DeclarationName | undefined, sourceFile: ts.SourceFile): string | null {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return node.getText(sourceFile);
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function pushUniqueSymbol(symbols: ParsedSymbol[], next: ParsedSymbol) {
  if (!symbols.some(symbol => symbol.type === next.type && symbol.name === next.name && symbol.line === next.line && symbol.containerName === next.containerName)) {
    symbols.push(next);
  }
}

function resolveImportPath(language: string, context: ParserContext, filePath: string, specifier: string): string | undefined {
  if (language === 'python') {
    return resolvePythonImport(context.repoRoot, filePath, specifier);
  }
  if (isLocalSpecifier(specifier)) {
    return resolveLocalImport(context.repoRoot, filePath, specifier);
  }
  return undefined;
}

function pythonImportKind(specifier: string, resolvedPath?: string): ParsedImport['kind'] {
  if (resolvedPath) return 'local';
  if (specifier.startsWith('.')) return 'unresolved';
  const root = specifier.split('.')[0] ?? specifier;
  return PYTHON_STDLIB_MODULES.has(root) ? 'external' : 'unresolved';
}

function parseTypescriptFile(filePath: string, content: string, context: ParserContext): ParsedFile {
  const relativePath = normalizePath(path.relative(context.repoRoot, filePath));
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const symbols: ParsedSymbol[] = [];
  const imports: ParsedImport[] = [];
  const calls: ParsedCall[] = [];
  const inheritances: ParsedInheritance[] = [];
  const stack: Array<{ type: 'class' | 'function'; name: string; line: number }> = [];

  const pushFunction = (name: string, node: ts.Node, signature?: string, exported?: boolean) => {
    const currentClass = [...stack].reverse().find(entry => entry.type === 'class');
    pushUniqueSymbol(symbols, {
      type: 'function',
      name,
      line: lineOf(sourceFile, node),
      containerName: currentClass?.name,
      signature,
      exported,
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const bindings: ParsedImportBinding[] = [];
      if (node.importClause?.name) {
        bindings.push({ localName: node.importClause.name.text, importedName: 'default', isDefault: true });
      }
      if (node.importClause?.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          bindings.push({ localName: node.importClause.namedBindings.name.text, importedName: '*', isNamespace: true });
        } else {
          for (const element of node.importClause.namedBindings.elements) {
            bindings.push({
              localName: element.name.text,
              importedName: element.propertyName?.text ?? element.name.text,
            });
          }
        }
      }
      imports.push({
        specifier,
        line: lineOf(sourceFile, node),
        kind: isLocalSpecifier(specifier) ? 'local' : 'external',
        bindings,
        resolvedPath: resolveImportPath(getLanguageSpec(filePath)?.name ?? 'javascript', context, filePath, specifier),
      });
    } else if (ts.isFunctionDeclaration(node) && node.name?.text) {
      const name = node.name.text;
      pushFunction(name, node, node.parameters.map(parameter => parameter.name.getText(sourceFile)).join(', '), hasExportModifier(node));
      stack.push({ type: 'function', name, line: lineOf(sourceFile, node) });
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    } else if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
      const name = node.parent.name.text;
      const variableStatement = node.parent.parent?.parent;
      pushFunction(name, node, node.parameters.map(parameter => parameter.name.getText(sourceFile)).join(', '), !!variableStatement && hasExportModifier(variableStatement));
      stack.push({ type: 'function', name, line: lineOf(sourceFile, node) });
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    } else if (ts.isMethodDeclaration(node)) {
      const name = propertyName(node.name, sourceFile);
      if (name) {
        pushFunction(name, node, node.parameters.map(parameter => parameter.name.getText(sourceFile)).join(', '));
        stack.push({ type: 'function', name, line: lineOf(sourceFile, node) });
        ts.forEachChild(node, visit);
        stack.pop();
        return;
      }
    } else if (ts.isClassDeclaration(node) && node.name?.text) {
      const name = node.name.text;
      pushUniqueSymbol(symbols, {
        type: 'class',
        name,
        line: lineOf(sourceFile, node),
        exported: hasExportModifier(node),
      });
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const typeNode of clause.types) {
            const expressionText = typeNode.expression.getText(sourceFile);
            inheritances.push({
              className: name,
              classLine: lineOf(sourceFile, node),
              baseName: expressionText.split('.').at(-1) ?? expressionText,
              line: lineOf(sourceFile, typeNode),
              kind: clause.token === ts.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends',
            });
          }
        }
      }
      stack.push({ type: 'class', name, line: lineOf(sourceFile, node) });
      ts.forEachChild(node, visit);
      stack.pop();
      return;
    } else if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      pushUniqueSymbol(symbols, {
        type: 'interface',
        name,
        line: lineOf(sourceFile, node),
        exported: hasExportModifier(node),
      });
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const typeNode of clause.types) {
            const expressionText = typeNode.expression.getText(sourceFile);
            inheritances.push({
              className: name,
              classLine: lineOf(sourceFile, node),
              baseName: expressionText.split('.').at(-1) ?? expressionText,
              line: lineOf(sourceFile, typeNode),
              kind: 'extends',
            });
          }
        }
      }
      ts.forEachChild(node, visit);
      return;
    } else if (ts.isTypeAliasDeclaration(node)) {
      pushUniqueSymbol(symbols, {
        type: 'type-alias',
        name: node.name.text,
        line: lineOf(sourceFile, node),
        exported: hasExportModifier(node),
      });
      return;
    } else if (ts.isEnumDeclaration(node)) {
      pushUniqueSymbol(symbols, {
        type: 'enum',
        name: node.name.text,
        line: lineOf(sourceFile, node),
        exported: hasExportModifier(node),
      });
      return;
    } else if (ts.isVariableStatement(node)) {
      const exported = hasExportModifier(node);
      for (const declaration of node.declarationList.declarations) {
        const initializer = declaration.initializer;
        const isFunctionInitializer = !!initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
        if (ts.isIdentifier(declaration.name) && !isFunctionInitializer) {
          pushUniqueSymbol(symbols, {
            type: 'variable',
            name: declaration.name.text,
            line: lineOf(sourceFile, declaration),
            exported,
          });
        }
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const bindings: ParsedImportBinding[] = [];
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          bindings.push({
            localName: element.name.text,
            importedName: element.propertyName?.text ?? element.name.text,
          });
        }
      } else if (!node.exportClause) {
        bindings.push({ localName: '*', importedName: '*', isNamespace: true });
      }
      imports.push({
        specifier,
        line: lineOf(sourceFile, node),
        kind: isLocalSpecifier(specifier) ? 'local' : 'external',
        bindings,
        resolvedPath: resolveImportPath(getLanguageSpec(filePath)?.name ?? 'javascript', context, filePath, specifier),
        isReExport: true,
      });
    } else if (ts.isCallExpression(node)) {
      const currentFunction = [...stack].reverse().find(entry => entry.type === 'function');
      if (currentFunction) {
        let calleeName = node.expression.getText(sourceFile);
        let qualifier: string | undefined;
        if (ts.isIdentifier(node.expression)) {
          calleeName = node.expression.text;
        } else if (ts.isPropertyAccessExpression(node.expression)) {
          calleeName = node.expression.name.text;
          qualifier = node.expression.expression.getText(sourceFile);
        }
        calls.push({
          callerName: currentFunction.name,
          callerLine: currentFunction.line,
          callerContainerName: [...stack].reverse().find(entry => entry.type === 'class')?.name,
          calleeName,
          qualifier,
          line: lineOf(sourceFile, node),
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    path: filePath,
    relativePath,
    moduleName: getModuleName(context.repoRoot, filePath),
    language: getLanguageSpec(filePath)?.name ?? 'javascript',
    content,
    lines: content.split(/\r?\n/),
    symbols,
    imports,
    calls,
    inheritances,
  };
}

function parseImportsFromLine(line: string, language: string, context: ParserContext, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];

  if (language === 'python') {
    const direct = line.match(/^import\s+(.+)$/);
    if (direct) {
      for (const part of direct[1].split(',')) {
        const trimmed = part.trim();
        const [name, alias] = trimmed.split(/\s+as\s+/);
        const resolvedPath = resolvePythonImport(context.repoRoot, filePath, name.trim());
        imports.push({
          specifier: name.trim(),
          line: 0,
          kind: pythonImportKind(name.trim(), resolvedPath),
          bindings: [{ localName: (alias || name).trim(), importedName: name.trim() }],
          resolvedPath,
        });
      }
    }
    const from = line.match(/^from\s+([A-Za-z0-9_./]+)\s+import\s+(.+)$/);
    if (from) {
      const specifier = from[1].trim();
      const resolvedPath = resolvePythonImport(context.repoRoot, filePath, specifier);
      const names = from[2].split(',').map(part => part.trim()).filter(Boolean);
      imports.push({
        specifier,
        line: 0,
        kind: pythonImportKind(specifier, resolvedPath),
        bindings: names.map(name => {
          const [importedName, localName] = name.split(/\s+as\s+/).map(part => part.trim());
          return { localName: localName || importedName, importedName };
        }),
        resolvedPath,
      });
    }
    return imports;
  }

  if (language === 'go') {
    const match = line.match(/^import\s+(?:([A-Za-z0-9_]+)\s+)?["`](.+)["`]$/);
    if (match) {
      imports.push({
        specifier: match[2],
        line: 0,
        kind: 'external',
        bindings: [{ localName: match[1] || match[2].split('/').at(-1) || match[2], importedName: match[2] }],
      });
    }
    return imports;
  }

  if (language === 'rust') {
    const match = line.match(/^use\s+(.+);$/);
    if (match) {
      const specifier = match[1].trim();
      imports.push({
        specifier,
        line: 0,
        kind: 'external',
        bindings: [{ localName: specifier.split('::').at(-1) || specifier, importedName: specifier }],
      });
    }
    return imports;
  }

  const generic = line.match(/^(?:import|include|require)\s+["<]?([^">;]+)[">]?/);
  if (generic) {
    const specifier = generic[1].trim();
    imports.push({
      specifier,
      line: 0,
      kind: isLocalSpecifier(specifier) ? 'local' : 'external',
      bindings: [],
    });
  }
  return imports;
}

function parseRegexFile(filePath: string, content: string, context: ParserContext): ParsedFile {
  const language = getLanguageSpec(filePath)?.name ?? 'generic';
  const relativePath = normalizePath(path.relative(context.repoRoot, filePath));
  const lines = content.split(/\r?\n/);
  const symbols: ParsedSymbol[] = [];
  const imports: ParsedImport[] = [];
  const calls: ParsedCall[] = [];
  const inheritances: ParsedInheritance[] = [];
  const classStack: Array<{ indent: number; name: string }> = [];
  const functionStack: Array<{ indent: number; name: string; containerName?: string; line: number }> = [];

  const currentFunction = (indent: number) => {
    while (functionStack.length > 0 && indent <= functionStack[functionStack.length - 1].indent) {
      functionStack.pop();
    }
    return functionStack[functionStack.length - 1];
  };

  const currentClass = (indent: number) => {
    while (classStack.length > 0 && indent <= classStack[classStack.length - 1].indent) {
      classStack.pop();
    }
    return classStack[classStack.length - 1];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    for (const parsedImport of parseImportsFromLine(trimmed, language, context, filePath)) {
      imports.push({
        ...parsedImport,
        line: lineNumber,
        resolvedPath: parsedImport.resolvedPath ?? resolveImportPath(language, context, filePath, parsedImport.specifier),
      });
    }

    if (language === 'python') {
      const classMatch = trimmed.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]+)\))?:/);
      if (classMatch) {
        const name = classMatch[1];
        symbols.push({ type: 'class', name, line: lineNumber });
        classStack.push({ indent, name });
        if (classMatch[2]) {
          for (const baseName of classMatch[2].split(',').map(value => value.trim()).filter(Boolean)) {
            inheritances.push({ className: name, classLine: lineNumber, baseName, line: lineNumber });
          }
        }
        continue;
      }

      const functionMatch = trimmed.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\):/);
      if (functionMatch) {
        const container = currentClass(indent);
        symbols.push({
          type: 'function',
          name: functionMatch[1],
          line: lineNumber,
          containerName: container?.name,
          signature: functionMatch[2],
        });
        functionStack.push({ indent, name: functionMatch[1], containerName: container?.name, line: lineNumber });
        continue;
      }
    } else if (language === 'go') {
      const typeMatch = trimmed.match(/^type\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:struct|interface)/);
      if (typeMatch) {
        symbols.push({ type: 'class', name: typeMatch[1], line: lineNumber });
        continue;
      }

      const methodMatch = trimmed.match(/^func\s+\(\s*[^)]+\)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      if (methodMatch) {
        symbols.push({ type: 'function', name: methodMatch[1], line: lineNumber, signature: methodMatch[2] });
        functionStack.push({ indent, name: methodMatch[1], line: lineNumber });
        continue;
      }

      const functionMatch = trimmed.match(/^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      if (functionMatch) {
        symbols.push({ type: 'function', name: functionMatch[1], line: lineNumber, signature: functionMatch[2] });
        functionStack.push({ indent, name: functionMatch[1], line: lineNumber });
        continue;
      }
    } else if (language === 'rust') {
      const classMatch = trimmed.match(/^(?:struct|trait|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (classMatch) {
        symbols.push({ type: 'class', name: classMatch[1], line: lineNumber });
        continue;
      }

      const implMatch = trimmed.match(/^impl(?:<[^>]+>)?\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (implMatch) {
        classStack.push({ indent, name: implMatch[1] });
        continue;
      }

      const functionMatch = trimmed.match(/^fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      if (functionMatch) {
        const container = currentClass(indent);
        symbols.push({
          type: 'function',
          name: functionMatch[1],
          line: lineNumber,
          containerName: container?.name,
          signature: functionMatch[2],
        });
        functionStack.push({ indent, name: functionMatch[1], containerName: container?.name, line: lineNumber });
        continue;
      }
    } else {
      const classMatch = trimmed.match(/^(?:class|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (classMatch) {
        symbols.push({ type: 'class', name: classMatch[1], line: lineNumber });
        continue;
      }

      const functionMatch = trimmed.match(/^(?:def|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      if (functionMatch) {
        symbols.push({ type: 'function', name: functionMatch[1], line: lineNumber, signature: functionMatch[2] });
        functionStack.push({ indent, name: functionMatch[1], line: lineNumber });
        continue;
      }
    }

    const activeFunction = currentFunction(indent);
    if (!activeFunction) continue;

    const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z_][A-Za-z0-9_]*))?\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = callPattern.exec(trimmed)) !== null) {
      const qualifier = match[2] ? match[1] : undefined;
      const calleeName = match[2] || match[1];
      if (calleeName === 'if' || calleeName === 'for' || calleeName === 'while' || calleeName === 'switch' || calleeName === 'return') {
        continue;
      }
      calls.push({
        callerName: activeFunction.name,
        callerLine: activeFunction.line,
        callerContainerName: activeFunction.containerName,
        calleeName,
        qualifier,
        line: lineNumber,
      });
    }
  }

  return {
    path: filePath,
    relativePath,
    moduleName: getModuleName(context.repoRoot, filePath),
    language,
    content,
    lines,
    symbols,
    imports,
    calls,
    inheritances,
  };
}

export async function parseCodeFile(filePath: string, context: ParserContext): Promise<ParsedFile | null> {
  const spec = getLanguageSpec(filePath);
  if (!spec) return null;

  const content = await readFile(filePath, 'utf8');
  switch (spec.parser) {
    case 'typescript':
      return parseTypescriptFile(filePath, content, context);
    case 'python':
    case 'go':
    case 'rust':
    case 'generic':
      return parseRegexFile(filePath, content, context);
    default:
      return null;
  }
}
