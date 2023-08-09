
/**
 * Retoune la <div> s'il y a un numéro d'équipe
 * 
 * @param {string} squad Le numéro d'équipe tel qu'enregistré dans le json
 * @returns Un string à afficher après le nom de l'équipe
 */
function get_div_squad(squad) {
	if (squad === '1') {
		return ''
	}
	else if(squad) {
		return ` - ${squad}`
	} else {
		return ''
	}
}

function compute_next_matchday(games) {
	next_matchday = 1
	for (g in games) {
		next_matchday = games[g].jour
		if (!games[g].match_joue) {
			break
		}
	}
	return next_matchday
}

function compute_nb_matchdays(games) {
	matchday_counter = 1
	for (g in games) {
		if (games[g].jour > matchday_counter) {
			matchday_counter = games[g].jour
		}
	}
	return matchday_counter
}

/**
 * Affiche les rencontres sélectionné sur une classe CSS choisi
 * 
 * @param {array} games Liste des rencontres (objets extraits du json)
 * @param {string} main_class La lcasse html dans laquelle afficher les rencontres
 * @param {string} favorite_club_name Nom du club favori
 * @param {string} page_club_name Nom de la page du club à afficher (doit être vide si aucun club à afficher)
 * @param {boolean} b_indicator_favorite Affichage de l'indicateur de l'équipe favorite
 * @param {boolean} b_indicator_day Affichage de la journée de la rencontre
 */
function display_fixtures(games, main_class, favorite_club_name, page_club_name, b_indicator_favorite=false, b_indicator_day=false) {
	document.getElementById(main_class).innerHTML = ''
	for (g in games) {
		fixture = games[g]
		indicator_team_selected = ''
		home_squad = get_div_squad(fixture.equipe_domicile_numero)
		away_squad = get_div_squad(fixture.equipe_exterieur_numero)
		fixture_color = ''
		indicator_team_selected_class = ''

        if ((true == b_indicator_favorite) &&
            (favorite_club_name != page_club_name) &&
            ((fixture.club_domicile == favorite_club_name) || (fixture.club_exterieur == favorite_club_name))) {
			indicator_team_selected_class = 'fixture-matchday-team-selected'
            fixture_color = 'fixture-selected'
			/* Ne pas avoir un double indicateur si le jour est déjà mis en avant */
			if (false == b_indicator_day) {
				indicator_team_selected = '<div class="fixture-indicator-team-selected"></div>'
			}
		}
        
        if ( page_club_name === '' ) {
            team_to_highlight = favorite_club_name
        }
        else {
            team_to_highlight = page_club_name
        }

		if (fixture.match_joue) {
			home_score = fixture.resultat_equipe_domicile
			away_score = fixture.resultat_equipe_exterieur
			if (team_to_highlight == fixture.club_domicile) {
				if (home_score > away_score) {
					fixture_color = 'fixture-w'
				}
				else {
					fixture_color = 'fixture-l'
				}
			} else if (team_to_highlight == fixture.club_exterieur) {
				if (home_score > away_score) {
					fixture_color = 'fixture-l'
				}
				else {
					fixture_color = 'fixture-w'
				}
			}
			home_score = `<div class="fixture-result">${home_score}</div>`
			away_score = `<div class="fixture-result">${away_score}</div>`
			time = 'Terminé'
		} else {
			home_score = ''
			away_score = ''
			time = fixture.heure
		}

		day_indicator = ''
		if (true == b_indicator_day) {
			day_indicator = `<div class="fixture-matchday ${indicator_team_selected_class}">${fixture.jour}</div>`
		}

		document.getElementById(main_class).innerHTML +=
		`
			<div class="fixture ${fixture_color}">
				${day_indicator}
				<div class="fixture-teams">
					<div class="fixture-team">
						<a class="fixture-team-name" href="../team/?club=${fixture.club_domicile}">
							<div class="fixture-team-club">${fixture.club_domicile}${home_squad}</div>
						</a>
						${home_score}
					</div>
					<div class="fixture-team">
						<a class="fixture-team-name" href="../team/?club=${fixture.club_exterieur}">
							<div class="fixture-team-club">${fixture.club_exterieur}${away_squad}</div>
						</a>
						${away_score}
					</div>
				</div>
				<div class="fixture-date">
					<div class="fixture-day">${fixture.date}</div>
					<div class="fixture-time">${time}</div>
				</div>
				${indicator_team_selected}
			</div>
		`
	}
}

/**
 * Filtrer la liste de rencontres. La liste des rencontres donnée en paramètre
 * est copiée afin de ne pas la modifier
 * 
 * @param {array} games Liste de rencontres
 * @param {string} keep_team_name Nom de l'équipe à conserver (une seule équipe)
 * @param {boolean} b_keep_home_games Conserver les rencontres à domicile ?
 * @param {boolean} b_keep_away_games Conserver les recontres à l'extérieur ?
 * @returns La liste des rencontres avec uniquement les rencontres qui répondent aux critères
 */
function filter_games(games, keep_team_name, b_keep_home_games, b_keep_away_games) {
	/* Copier le tableau pour ne pas modifier la liste des rencontres */
	filtered_games = games.slice()

	i = filtered_games.length
	while (i--) {
		// Exclure les matchs auxquels l'équipe ne participe pas
		if ( (keep_team_name != filtered_games[i].club_domicile) && (keep_team_name != filtered_games[i].club_exterieur) ) {
			filtered_games.splice(i, 1);
			continue
		}
		// Si demandé, exclure les matchs où l'équipe joue à domicile
		if ( (b_keep_home_games == false) && (keep_team_name == filtered_games[i].club_domicile) ) {
			filtered_games.splice(i, 1);
			continue
		}
		// Si demandé, exclure les matchs où l'équipe joue à l'extérieur
		if ( (b_keep_away_games == false) && (keep_team_name == filtered_games[i].club_exterieur)) {
			filtered_games.splice(i, 1);
			continue
		}
	}
	return filtered_games
}

/**
 * Calcul du classement jusqu'à un jour donné. Les égalités à la différence de
 * points ne sont gérées
 * 
 * @param {array} teams Liste des équipes du championnat 
 * @param {array} games Liste de rencontres à prendre en compte pour le classement
 * @param {integer} until_matchday Numéro de la journée à laquelle arrêter le calcul
 * @returns La liste des équipes classées de la meilleure à la moins bonne
 */
function compute_ranking_until_matchday(teams, games, until_matchday) {
	ranking = []
	for (t in teams) {
		club_name = teams[t].club
		filtered_games = filter_games(games, club_name, true, true)
		team_points = 0
		team_difference = 0
		match_counter = 1

		for (g in filtered_games) {
			if (match_counter > until_matchday) {
				/* do not break to handle the case where games are not sorted by matchday */
				continue
			}
			fixture = filtered_games[g]
			if (fixture.match_joue) {
				if (club_name == fixture.club_domicile ) {
					team_score = fixture.resultat_equipe_domicile
					opponent_score = fixture.resultat_equipe_exterieur
				} else {
					team_score = fixture.resultat_equipe_exterieur
					opponent_score = fixture.resultat_equipe_domicile
				}
				team_score = parseInt(team_score)
				opponent_score = parseInt(opponent_score)
				if (team_score > opponent_score) {
					team_points += 2
				} else {
					team_points += 1
				}
				team_difference += team_score - opponent_score
				match_counter++
			}
		}
		team_points = team_points * 10000 + team_difference
		ranking.push([club_name, team_points])
	}
	ranking.sort((a, b) => b[1] - a[1])
	return ranking
}