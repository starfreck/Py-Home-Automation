import json


def write(key, value):
    with open('settings/config.json', 'rw') as f:
        config = json.load(f)
        config[key] = value
        json.dump(config, f)
    return True


def read(key):
    try:
        with open('settings/config.json', 'r') as f:
            config = json.load(f)
        return config[key]

    except:
        return False