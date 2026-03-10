from helpers import normalize_name as clean_name
from helpers import Greeter


class LoudGreeter(Greeter):
    def shout(self, name):
        return self.greet(name).upper()


def make_slug(name):
    return clean_name(name)
