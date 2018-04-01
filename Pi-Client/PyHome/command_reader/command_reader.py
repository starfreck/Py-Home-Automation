import json


def reader(key):
    try:
        with open('settings/commands.json', 'r') as f:
            config = json.load(f)
        return config[key]

    except:
        return False
