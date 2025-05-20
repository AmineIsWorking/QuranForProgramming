import json
import os
import re
from pathlib import Path

def clean_sheikh_name(sheikh_name):
    """Nettoie le nom du sheikh pour créer un nom de fichier valide"""
    # Remplacer les caractères problématiques
    cleaned = sheikh_name.replace('`', '').replace('-', '_')
    # Remplacer les espaces par des underscores
    cleaned = cleaned.replace(' ', '_')
    # Supprimer tout autre caractère spécial éventuel
    cleaned = re.sub(r'[^\w_]', '', cleaned)
    return cleaned

def split_quran_json(input_file):
    # Obtenir le répertoire parent du fichier d'entrée
    input_dir = os.path.dirname(input_file)
    
    # Créer un sous-dossier 'sheikhs' s'il n'existe pas
    output_dir = os.path.join(input_dir, 'sheikhs')
    os.makedirs(output_dir, exist_ok=True)
    
    # Lire le fichier JSON d'entrée
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Parcourir chaque sheikh dans le JSON
    for sheikh_name, surahs_data in data.items():
        # Créer la structure de données pour ce sheikh
        sheikh_data = {}
        
        # Copier les données des sourates
        for surah_num, surah_info in surahs_data.items():
            sheikh_data[surah_num] = surah_info
        
        # Générer un nom de fichier propre
        clean_name = clean_sheikh_name(sheikh_name)
        filename = f"{clean_name}.json"
        filepath = os.path.join(output_dir, filename)
        
        # Écrire le fichier JSON pour ce sheikh
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(sheikh_data, f, ensure_ascii=False, indent=2)
        
        print(f"Fichier créé : {filepath}")

if __name__ == "__main__":
    # Chemin vers le fichier d'entrée (peut être relatif ou absolu)
    INPUT_JSON = "quran-com_timestamps.json"  # Mettez le chemin complet si nécessaire
    
    # Vérifier que le fichier existe
    if not os.path.exists(INPUT_JSON):
        print(f"Erreur : Le fichier {INPUT_JSON} n'existe pas")
        exit(1)
    
    # Exécuter la conversion
    split_quran_json(INPUT_JSON)
    print("Conversion terminée !")