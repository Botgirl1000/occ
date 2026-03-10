def normalize_name(name):
    return name.strip().lower()


class Greeter:
    def greet(self, name):
        normalized = normalize_name(name)
        return f"hello {normalized}"
