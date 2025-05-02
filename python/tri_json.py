import json

# Charger le fichier JSON
with open('./QuranForProgramming/js/quran-com_timestamps.json', 'r') as file:
    json_data = file.read()

# Charger le JSON en tant que dictionnaire Python
data = json.loads(json_data)

# Modifier les clés du dictionnaire en filtrant celles contenant '_Murattal'
updated_data = {}
for key, value in data.items():
    if '_Murattal' in key:  # Vérifier si '_Murattal' est dans la clé originale
        new_key = key.split('_')[0]  # Supprimer tout ce qui suit '_'
        updated_data[new_key] = value

# Afficher les nouvelles clés
print(list(updated_data.keys()))

# Sauvegarder le dictionnaire modifié dans un nouveau fichier JSON
with open('./QuranForProgramming/js/quran-com_timestamps_updated.json', 'w') as file:
    json.dump(updated_data, file, ensure_ascii=False, indent=4)