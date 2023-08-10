
#Imports
from config import championship_url
from functions import get_club_id, get_team_club, get_team_link, get_team_squad
from datetime import datetime
from bs4 import BeautifulSoup
from ast import literal_eval
import requests
import json
import re
import operator
import os

def print_message(message):
    print(datetime.now().strftime('%H:%M:%S'),' - ',message)

def update_championship(championship_url):
    # Message de lancement du scraper
    print('----------')
    print_message('Recovery of data from ' + championship_url)

    # Initialisation de la page
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Safari/605.1.15'}
    page = requests.get(championship_url, headers=headers)
    print_message('Page response: {}'.format(page))

    soup = BeautifulSoup(page.text, 'html.parser')

    # Nom du championnat
    championship_name = soup.select_one('#idTdDivision')
    championship_name = championship_name.text
    print_message('Getting data {}'.format(championship_name))

    # Lien du championnat
    championship_link = championship_url

    # Récupération de l'ID du championnat
    championship_id = re.sub(r'^https://resultats.ffbb.com/championnat/', '', championship_url)
    championship_id = re.sub(r'.html', '', championship_id)

    # Comité de championnat
    championship_committee = soup.select('.cadre a')
    championship_committee = championship_committee[0].text
    championship_committee = championship_committee.title()

    # Poules du championnat
    championship_pool = soup.select('#idTdDivision script')
    championship_pool = championship_pool[0].text
    championship_pool = championship_pool.split('=')[-1]
    championship_pool = re.sub(r';', '', championship_pool)

    pools = literal_eval(championship_pool)

    championship_pools = []

    for pool_id, pool_name in pools:
        championship_pool = pool_name
        print_message('Getting data for {}'.format(championship_pool))

        # Équipes du championnat
        pool_id_hex = hex(pool_id).split('x')[-1]
        ranking_url = 'https://resultats.ffbb.com/championnat/classements/' + championship_id + pool_id_hex + '.html'

        page = requests.get(ranking_url)
        print_message('Page response: {}'.format(page))
        soup = BeautifulSoup(page.text, 'html.parser')
        teams = soup.select('.liste tr')
        teams_data = []
        championship_games = []

        for team in teams:
            try:
                if (None == team.find('a')):
                    continue

                # Informations de l'équipe
                team_name = team.find('a').contents[0] # Nom de l'équipe
                team_club = get_team_club(team_name) # Nom du club
                squad = get_team_squad(team_name) # Numéro de l'équipe
                team_link = team.find('a')['href'] # Lien partiel du club
                club_id = get_club_id(team_link) # ID du club
                team_link = get_team_link(team_link) # Lien entier du club
                ranking_row = team.find_all('td') # Ligne dans le classement 
                # Il doit y avoir 18 td mais dans certains championnats, les bonus ne
                # sont pas listés. Il faut donc compenser après la colonne 6
                substract_no_bonus = 0
                if (17 == len(ranking_row)):
                    substract_no_bonus = -1
                ranking = int(ranking_row[0].contents[0]) # Rang
                points = int(ranking_row[2].contents[0]) # Points
                games_played = int(ranking_row[3].contents[0]) # Matchs joués
                won_games = int(ranking_row[4].contents[0]) # Matchs gagnés
                lost_games = int(ranking_row[5].contents[0]) # Matchs perdus
                penalties = int(ranking_row[9+substract_no_bonus].contents[0])
                forfeits = int(ranking_row[10+substract_no_bonus].contents[0])
                points_scored = int(ranking_row[15+substract_no_bonus].contents[0]) # Différence de points
                points_cashed = int(ranking_row[16+substract_no_bonus].contents[0]) # Différence de points
                difference = int(ranking_row[17+substract_no_bonus].contents[0]) # Différence de points
                # Rencontres de l'équipes
                fixtures_url = 'https://resultats.ffbb.com/championnat/equipe/division/' + championship_id + pool_id_hex + club_id + '.html'
                page = requests.get(fixtures_url)
                soup = BeautifulSoup(page.text, "html.parser")
                fixtures = soup.select(".liste tr")
                fixtures_data = []
                for fixture in fixtures:
                    all_fixtures = fixture.findAll('td')
                    # S'il n''y a pas au moins 6 cellules sur la ligne, ce n'est pas valide
                    if len(all_fixtures) < 6 :
                        continue
                    try:
                        # Si le contenu de la première cellule est "Jour", c'est un titre
                        if 'Jour' == all_fixtures[0].contents[0] :
                            continue

                        matchday = int(all_fixtures[0].contents[0]) # Jour de la rencontre
                        date = all_fixtures[1].contents[0] # Date de la rencontre
                        hour = all_fixtures[2].contents[0] # Heure de la recontre
                        home_team = all_fixtures[3].contents[0].contents[0] # Équipe à domicile
                        away_team = all_fixtures[4].contents[0].contents[0] # Équipe à l'extérieur
                        home_club = get_team_club(home_team) # Club à domicile
                        away_club = get_team_club(away_team) # Club à l'extérieur
                        home_squad = get_team_squad(home_team) # Numéro de l'équipe à domicile
                        away_squad = get_team_squad(away_team) # Numéro de l'équipe à l'extérieur
                        fixture_result = all_fixtures[5].contents[0] # Résultat de la rencontre

                        # Détermination si le match est joué
                        if (fixture_result != '-'):
                            fixture_played = True
                            home_team_score = int(re.sub(r" - [0-9]+", "", fixture_result)) # Score de l'équipe à domicile
                            away_team_score = int(re.sub(r"[0-9]+ - ", "", fixture_result)) # Score de l'équipe à l'extérieur
                        else:
                            fixture_played = False
                            home_team_score = 0
                            away_team_score = 0

                        fixture_data = {'match_joue': fixture_played, 'jour': matchday, 'heure': hour, 'date': date, 'club_domicile': home_club, 'equipe_domicile_numero': home_squad, 'club_exterieur': away_club, 'equipe_exterieur_numero': away_squad, 'resultat_equipe_domicile': home_team_score, 'resultat_equipe_exterieur': away_team_score}
                        
                        # Vérification de la présence du match dans la liste
                        b_found = False
                        for game in championship_games :
                            if game == fixture_data :
                                b_found = True
                                break
                        # Seuls les matchs non trouvés sont ajoutés
                        if b_found == False :
                            championship_games.append(fixture_data)
                    except Exception as e:
                        print_message("ERREUR lors de l'extraction de rencontre: ")
                        print(e)
                        continue
                # Formattage et ajout des données de l'équipe
                team_data = {'club': team_club, 'equipe': squad, 'id_club': club_id, 'lien_equipe': team_link, 'classement': ranking, 'points': points, 'matchs_joues': games_played, 'matchs_gagnes': won_games, 'matchs_perdus': lost_games, 'penalites': penalties, 'forfaits': forfeits, 'points_marques': points_scored, 'points_encaisses': points_cashed, 'difference': difference}
                teams_data.append(team_data)
            except Exception as e:
                print_message("ERREUR lors de l'extraction de l'équipe: ")
                print(e)
                continue

        # Tri des matchs par journée
        championship_games.sort(key=operator.itemgetter('jour'))
        pool_data = {'id': pool_id, 'poule': pool_name, 'equipes': teams_data, 'rencontres': championship_games}
        championship_pools.append(pool_data)

    # Formattage des données
    championship_data = {'id': championship_id, 'nom': championship_name, 'lien_championnat': championship_link, 'comite': championship_committee, 'poules': championship_pools}

    # Création du fichier JSON
    output_filename = championship_id+'.json'
    with open(output_filename, 'w', encoding='latin-1') as f:
        json.dump(championship_data, f, indent='\t', ensure_ascii=False) # remove indent and add separators to minimize the output
    print_message('Done! Data has been refreshed in JSON file')

    print_message('Updating list of championships')

    filename = 'championships.json'

    if (os.path.isfile(filename)):
        f = open(filename, 'r', encoding='latin-1')
        data_json = json.load(f)
        
        # Vérifier si l'organisation est déjà présente
        is_organisation_in_file = False
        is_championship_in_file = False
        is_file_to_be_updated = False
        for organisation in data_json:
            if ( championship_committee == organisation['organisation'] ):
                is_organisation_in_file = True
                print_message("Organisation " + organisation['organisation'] + " déjà présent dans le json")
                for championship in organisation['championships']:
                    if ( championship_id == championship['id'] ):
                        # Le championnat est déjà présent, pas besoin de le rajouter
                        is_championship_in_file = True
                        print_message("Championnat " + championship['nom'] + " déjà présent dans le json")
                        break
                    else:
                        continue

                if ( False == is_championship_in_file ):
                    # Ajouter le championnat à l'organisation
                    is_file_to_be_updated = True
                    print_message("Championnat " + championship_name + " non présent, il faut le rajouter")
                    championship_data = { 'id': championship_id, 'nom': championship_name, 'lien_championnat': championship_link }
                    organisation['championships'].append(championship_data)
                break
            else:
                continue

        if ( False == is_organisation_in_file ):
            # Ajouter l'organisation à la liste
            is_file_to_be_updated = True
            print_message("Organisation " + championship_committee + " non présent, il faut le rajouter")
            championship_data = [ { 'id': championship_id, 'nom': championship_name, 'lien_championnat': championship_link } ]
            organisation_data = { 'organisation': championship_committee, 'championships': championship_data }
            data_json.append(organisation_data)

        f.close()

        if (True == is_file_to_be_updated):
            f = open(filename, 'w', encoding='latin-1')
            json.dump(data_json, f, indent='\t', ensure_ascii=False)
            f.close()
        
    else:
        print_message("Création de ' + filename + ' qui n'existe pas")
        f = open(filename, 'w', encoding='latin-1')
        championship_data = [ { 'id': championship_id, 'nom': championship_name, 'lien_championnat': championship_link } ]
        organisation_data = [ { 'organisation': championship_committee, 'championships': championship_data } ]
        json.dump(organisation_data, f, indent='\t', ensure_ascii=False)
        f.close()

    print_message('Update finished')


for url in championship_url:
    update_championship(url)