import json
from helpers import normalize_name
from missing_module import missing_value


def inspect_deps(name):
    return json.dumps({
        "name": normalize_name(name),
        "missing": missing_value,
    })
