<?php
include_once('./simple_html_dom.php');

function get_team_squad($team_name) {
    $team_squad_search = preg_match('/ - [0-9]/', $team_name); // Recherche numéro d'équipe
    if ( $team_squad_search ) {
        $team_squad = explode(' ', $team_name);
        $team_squad = end($team_squad); // Récupération du numéro
        $team_squad = preg_replace('/\s+/', '', $team_squad); // Suppression surplu
        return $team_squad;
    }
    else {
        return false;
    }
}

function get_team_club($team_name) {
    $team_name = preg_replace('/ - [0-9]/', '', $team_name); // Suppression surplu
    return trim($team_name);
}

function scrap_ffbb_championship($championship_id) {
    /* Récupération de la page du championnat pour avoir les informations du championnat */
    $url = "https://resultats.ffbb.com/championnat/$championship_id.html";
    $html_championship = file_get_html($url);

    $ret['Titre'] = $html_championship->find('title', 0)->innertext;
    $el_name = $html_championship->getElementById('idTdDivision');
    $el_pool = $el_name->find('script', 0);
    $temp_pool = $el_pool->innertext;

    $el_name->removeChild($el_name->find('script', 0));
    $el_name->removeChild($el_name->find('input', 0));
    $championship_name = $el_name->innertext;
    $championship_url = $url;
    $championship_committee = $html_championship->find('table[class="cadre"] a', 0)->innertext;

    /* Récupération d'une liste de poules qu'il faut parser en un tableau */
    $parts = explode('=', $temp_pool);
    $temp = preg_replace('/[\']/', '"', end($parts));
    $temp = preg_replace('/[;]/', ' ', $temp);
    $ret['championship_pools'] = json_decode($temp);

    $championship_pools = [];

    /* Pour chaque poule */
    foreach ($ret['championship_pools'] as &$pool) {
        $pool_id = $pool[0];
        $pool_name = $pool[1];
        $pool_id_hex = dechex($pool_id);

        /* Récupération de la page du classement pour avoir toutes les équipes de la poule */
        $ranking_url = "https://resultats.ffbb.com/championnat/classements/$championship_id$pool_id_hex.html";
        $html_ranking = file_get_html($ranking_url);
        $array_teams_rows = $html_ranking->find('table[class="liste"] tr');

        $teams_data = [];
        $championship_games = [];

        foreach ($array_teams_rows as $row_team) {
            $el_a_team = $row_team->find('a', 0);

            if (null == $el_a_team) {
                continue;
            }

            $team_name = $el_a_team->innertext;
            $team_club = get_team_club($team_name);
            $squad = get_team_squad($team_name);

            $team_link = $el_a_team->getAttribute('href');
            $club_id = $team_link;

            /* Le lien vers la page de l'équipe est relatif, on le reconstruit */
            $team_link = preg_replace('/\.\./', '', $team_link);
            $team_link = "https://resultats.ffbb.com/championnat$team_link";
            /* L'id de l'équipe se trouve dans le lien : en hexa au milieu du lien
                et en décimal à la fin. On récupère l'id en décimal car c'est plus
                facile puis on le convertit en hexa pour construit d'autres liens */
            $club_id = explode('=', $club_id);
            $club_id = end($club_id);
            $club_id = dechex($club_id);

            $el_td_team = $row_team->find('td');

            if (count($el_td_team) == 18) {
                $ranking = (int)($el_td_team[0]->innertext); // Rang
                $points = (int)($el_td_team[2]->innertext); // Points
                $games_played = (int)($el_td_team[3]->innertext); // Matchs joués
                $won_games = (int)($el_td_team[4]->innertext); // Matchs gagnés
                $lost_games = (int)($el_td_team[5]->innertext); // Matchs perdus
                $penalties = (int)($el_td_team[9]->innertext);
                $forfeits = (int)($el_td_team[10]->innertext);
                $points_scored = (int)($el_td_team[15]->innertext); // Points marqués
                $points_cashed = (int)($el_td_team[16]->innertext); // Points encaissés
                $difference = (int)($el_td_team[17]->innertext); // Différence de points

                /* Récupération de la page du calendrier de l'équipe */
                $fixtures_url = "https://resultats.ffbb.com/championnat/equipe/division/$championship_id$pool_id_hex$club_id.html";
                $html_fixtures = file_get_html($fixtures_url);
                $array_fixtures_rows = $html_fixtures->find('table[class="liste"] tr');

                foreach ($array_fixtures_rows as $row_fixture) {
                    $el_td_fixture = $row_fixture->find('td');
                    /* S'il n''y a pas au moins 6 cellules sur la ligne, ce n'est pas valide */
                    if (count($el_td_fixture) < 6 ) {
                        continue;
                    }
                    /* Si le contenu de la première cellule est "Jour", c'est un titre */
                    if ('Jour' == $el_td_fixture[0]->innertext) {
                        continue;
                    }

                    $matchday = (int)($el_td_fixture[0]->innertext); // Jour de la rencontre
                    $date = $el_td_fixture[1]->innertext; // Date de la rencontre
                    $hour = $el_td_fixture[2]->innertext; // Heure de la recontre
                    $home_team = $el_td_fixture[3]->find('a',0)->innertext; // Équipe à domicile
                    $away_team = $el_td_fixture[4]->find('a',0)->innertext; // Équipe à l'extérieur
                    $home_club = get_team_club($home_team); // Club à domicile
                    $away_club = get_team_club($away_team); // Club à l'extérieur
                    $home_squad = get_team_squad($home_team); // Numéro de l'équipe à domicile
                    $away_squad = get_team_squad($away_team); // Numéro de l'équipe à l'extérieur
                    $fixture_result = $el_td_fixture[5]->innertext; // Résultat de la rencontre

                    /* Détermination si le match est joué */
                    if ($fixture_result != '-') {
                        $fixture_played = true;
                        $parts = explode('-', $fixture_result);
                        $home_team_score = (int)(preg_replace('/\s+/', '', $parts[0])); // Score de l'équipe à domicile
                        $away_team_score = (int)(preg_replace('/\s+/', '', $parts[1])); // Score de l'équipe à l'extérieur
                    }
                    else {
                        $fixture_played = false;
                        $home_team_score = 0;
                        $away_team_score = 0;
                    }
                    /* Formattage et ajout des données de la rencontre */
                    $fixture_data = [
                        'match_joue' => $fixture_played,
                        'jour' => $matchday, 
                        'heure' => $hour,
                        'date' => $date,
                        'club_domicile' => $home_club,
                        'equipe_domicile_numero' => $home_squad, 
                        'club_exterieur' => $away_club,
                        'equipe_exterieur_numero' => $away_squad,
                        'resultat_equipe_domicile' => $home_team_score,
                        'resultat_equipe_exterieur' => $away_team_score
                    ];
                    
                    /* Vérification de la présence du match dans la liste */                      
                    if (!in_array($fixture_data, $championship_games)) {
                        /* Seuls les matchs non trouvés sont ajoutés */
                        array_push($championship_games, $fixture_data);
                    }
                }
            }
            /* Formattage et ajout des données de l'équipe */
            $team_data = [
                'club' => $team_club,
                'equipe' => $squad,
                'id_club' => $club_id,
                'lien_equipe' => $team_link,
                'classement' => $ranking,
                'points' => $points,
                'matchs_joues' => $games_played,
                'matchs_gagnes' => $won_games,
                'matchs_perdus' => $lost_games,
                'penalites' => $penalties,
                'forfaits' => $forfeits,
                'points_marques' => $points_scored,
                'points_encaisses' => $points_cashed,
                'difference' => $difference          
            ];

            array_push($teams_data, $team_data);
        }
        
        /* TODO trier les matchs par journée */
        //championship_games.sort(key=operator.itemgetter('jour'))

        $pool_data = [
            'id' => $pool_id,
            'poule' => $pool_name,
            'equipes' => $teams_data,
            'rencontres' => $championship_games
        ];

        array_push($championship_pools, $pool_data);
    }

    /* Formattage des données */
    $championship_data = [
        'id' => $championship_id,
        'nom' => $championship_name,
        'lien_championnat' => $championship_url,
        'comite' => $championship_committee,
        'poules' => $championship_pools
    ];

    /* Création du fichier JSON */
    $output_filename = "$championship_id.json";

    $json_data = json_encode($championship_data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    $file = fopen($output_filename ,'w');
    fwrite($file, $json_data);
    fclose($file);

    $html_fixtures->clear();
    unset($html_fixtures);
    $html_ranking->clear();
    unset($html_ranking);
    $html_championship->clear();
    unset($html_championship);  

    return;
}

scrap_ffbb_championship('b5e6211fe70c');

?>