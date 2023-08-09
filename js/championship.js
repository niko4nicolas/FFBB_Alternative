// |-----------------|
// |   Championnat   |
// |-----------------|

// TODO charger championnat donné (remove hardcoded path)
fetch('../data/data.json')
	.then((response) => response.json())
	.then((data) => {
		// Informations du championnat
		document.getElementsByClassName('header-subtitle')[0].innerHTML = data.comite // Comité du championnat
		document.getElementsByClassName('header-title')[0].innerHTML = data.nom // Nom du championnat

		// Chargement de la poule sélectionnée
		selected_pool_name = localStorage.getItem("selected_pool_name")
		if (!selected_pool_name) {
			localStorage.setItem("selected_pool_name", data.poules[0].poule);
			selected_pool_name = data.poules[0].poule
		}

		// Récupération de la balise de la sélection de poule
		pool_selection = document.getElementById('pool_selection')

		selected_pool = data.poules[0] // choisir une poule par défaut
		for (p in data.poules) {
			pool_name = data.poules[p].poule
			selected = ''
			if (pool_name == selected_pool_name) {
				selected_pool = data.poules[p] // choisir la poule sélectionnée si trouvée
				selected = 'selected'
			}
			pool_selection.innerHTML += `<option value="${pool_name}" ${selected}>${pool_name}</option>`
		}

		// Lien du classement FFBB officiel dans le logo FFBB de la tête de classement
		championship_id = parseInt(data.id, 16)
		document.getElementsByClassName('ranking-ffbb')[0].href = `${data.lien_championnat}?r=${championship_id}&d=${selected_pool.id}`
		// Mise à jour du nom de poule
		document.getElementsByClassName('ranking-pool')[0].innerHTML = selected_pool.poule

		// Toutes les rencontres de la poule
		games = selected_pool.rencontres
		// Toutes les équipes de la poule
		teams = selected_pool.equipes

		// Équipe sélectionnée
		selected_club_name = localStorage.getItem("selected_club_name")
		if (!selected_club_name) {
			localStorage.setItem("selected_club_name", teams[0].club);
			selected_club_name = teams[0].club
		}

		// Récupération de la balise de la sélection d'équipe
		team_selection = document.getElementById('team_selection')

		team_selection_index = 0
		// Affichage des équipes dans la sélection
		for (t in teams) {
			club_name = teams[t].club
			if (club_name == selected_club_name) {
				selected_team_indicator = '💙 '
				team_selection_index = t
			} else {
				selected_team_indicator = ''
			}
			team_selection.innerHTML += `<option value="${club_name}">${selected_team_indicator}${club_name}</option>`
		}

		// Mettre par défaut l'équipe sélectionnée
		team_selection.selectedIndex = team_selection_index

		// Changement de l'équipe sélectionnée
		team_selection.addEventListener("change", () => reload_new_team(team_selection.value))
		// Changement de la poule sélectionnée
		pool_selection.addEventListener("change", () => reload_new_pool(pool_selection.value))

		// Détermination de la prochaine journée avec des matchs à jouer
		next_matchday = compute_next_matchday(games)

		// Calculer le nombre de journées total
		matchday_counter = compute_nb_matchdays(games)

		// Récupération de la balise de la sélection de la journée
		matchday_selection = document.getElementById('matchday_selection')

		// FIXME: C'est toujours le premier choix qui est sélectionné
		for (let i = 1; i <= matchday_counter; i++) {
			if (i == next_matchday) {
				next_matchday_indicator = '🗓️ '
			} else {
				next_matchday_indicator = ''
			}
			matchday_selection.innerHTML += `<option value="${i}">${next_matchday_indicator}Jour ${i}</option>`
		}
		matchday_selection.innerHTML += `<option value="0">Tous</option>`

		// Mettre par défaut la journée actuelle
		matchday_selection.selectedIndex = next_matchday-1

		// Prochaine journée
		next_fixtures = load_matchday_fixtures(games, next_matchday)
		display_fixtures(next_fixtures, 'next_fixtures', selected_club_name, '', true, false)

		// Changement de journée
		matchday_selection.addEventListener("change", () => load_and_display_matchday_fixtures(games, matchday_selection.value, selected_club_name))

		// Précédent classement : prochaine journée - 2)
		ranking = compute_ranking_until_matchday(teams, games, next_matchday-2)

		// Classement général
		display_current_ranking(ranking)

		/* Evolution du classement */
		if (next_matchday > 2) {
			ranking_history = compute_ranking_history(teams, games, next_matchday-1)

			display_ranking_evolution(ranking_history)
		}
	})


// |---------------|
// |   Fonctions   |
// |---------------|

function display_ranking_evolution(ranking_history) {
	document.getElementsByClassName('charts')[0].innerHTML =
	`
		<div class="chart">
			<canvas id="ranking"></canvas>
		</div>
	`

	datasets = []
	colors = ["#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0"]

	let i = 0
	for (ranking_team in ranking_history) {
		dataset = {}
		color_index = i % colors.length
		dataset['label'] = ranking_team
		dataset['data'] = ranking_history[ranking_team]
		dataset['borderColor'] = colors[color_index]
		dataset['backgroundColor'] = colors[color_index]
		dataset['pointRadius'] = 3
		dataset['borderWidth'] = 3
		datasets.push(dataset)
		i++
	}

	const ctx = document.getElementById('ranking')
	const data_chart = {
		labels: matchday_data,
		datasets: datasets
	}
	config = get_chart_config(data_chart, "Evolution du classement")
	new Chart(ctx, config)
}

function compute_ranking_history(teams, games, until_matchday) {
	/* Construction d'un dictionnaire avec le nom de l'équipe comme clé
	et un tableau vide où seront stockés les classements par journée */
	ranking_history = {}
	for (t in teams) {
		ranking_history[teams[t].club] = []
	}

	matchday_data = []
	/* Calcul du classement pour chaque journée */
	for (let i = 1; i <= until_matchday; i++) {
		matchday_data.push(i)
		ranking_day = compute_ranking_until_matchday(teams, games, i)
		for (r in ranking_day) {
			club = ranking_day[r][0]
			ranking_history[club][i-1] = parseInt(r) +1
		}
	}
	return ranking_history
}

function display_current_ranking(ranking) {
	for (t in teams) {
		team = teams[t]
		for (ranking_team in ranking) {
			if (ranking[ranking_team][0] == team.club) {
				former_rank = parseInt(ranking_team) + 1
				current_rank = parseInt(team.classement)
				ranking_team = ranking[ranking_team]
				team_ranking_color = ''
				team_icon_color_green = 'rgb(29, 187, 121)'
				team_icon_color_red = 'rgb(255, 47, 84)'
				team_icon_color_grey = 'rgb(184, 184, 184)'
				if (team.club == selected_club_name) {
					team_ranking_color = 'ranking-team-selected'
				}
				if (former_rank > current_rank) {
					position_icon = `<svg width="12px" height="12px" viewBox="0 0 12 12"><path d="M1 8l5-5 5 5" stroke="${team_icon_color_green}" stroke-width="2"/></svg>`
				} else if (former_rank < current_rank) {
					position_icon = `<svg width="12px" height="12px" viewBox="0 0 12 12"><path d="M11 4L6 9 1 4" stroke="${team_icon_color_red}" stroke-width="2"/></svg>`
				} else {
					position_icon = `<svg width="8" height="8" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" stroke="${team_icon_color_grey}" stroke-width="16"/></svg>`
				}
			}
		}
		div_squad = get_div_squad(team.equipe) // Récupére la <div> du numéro de l'équipe si elle existe
		document.getElementsByClassName('ranking')[0].innerHTML +=
		`
		<li class="ranking-team ${team_ranking_color}">
			<a href="../team/?club=${team.club}">
				<div class="ranking-rank">${team.classement}</div>
				<div class="ranking-icon">${position_icon}</div>
				<div class="ranking-name">
					<div class="ranking-club">${team.club}${div_squad}</div>
				</div>
				<div>${team.matchs_joues}</div>
				<div class="hidden-on-mobile">${team.matchs_gagnes}</div>
				<div class="hidden-on-mobile">${team.matchs_perdus}</div>
				<div class="hidden-on-mobile">${team.points_marques}</div>
				<div class="hidden-on-mobile">${team.points_encaisses}</div>
				<div>${team.difference}</div>
				<div class="ranking-points">${team.points}</div>
				<div class="ranking-link hidden-on-mobile">
					<object><a href="${team.lien_equipe}" target="_blank">
						<svg viewBox="0 0 24 24"><path d="M21 3.6v16.8a.6.6 0 01-.6.6H3.6a.6.6 0 01-.6-.6V3.6a.6.6 0 01.6-.6h16.8a.6.6 0 01.6.6z"></path><path d="M15.025 8.025h-4.95m4.95 0v4.95m0-4.95l-3.535 3.536c-2.475 2.475 0 4.95 0 4.95"></path></svg>
					</a></object>
				</div>
			</a>
		</li>
		`	
	}
}

// Rencontres de la prochaine journée
function load_matchday_fixtures(games, selected_matchday) {
	next_fixtures = []
	for (g in games) {
		fixture = games[g]
		if (0 == selected_matchday || fixture.jour == selected_matchday) {
			next_fixtures.push(fixture)
		}
	}
	return next_fixtures
}

// Rencontres de la prochaine journée
function load_and_display_matchday_fixtures(games, selected_matchday, club_name) {
	next_fixtures = load_matchday_fixtures(games, selected_matchday) 
	display_fixtures(next_fixtures, 'next_fixtures', club_name, '', true, false)
}

function reload_new_team(new_team) {
	localStorage.setItem("selected_club_name", new_team);
	location.reload();
}

function reload_new_pool(new_pool) {
	localStorage.setItem("selected_pool_name", new_pool);
	location.reload();
}

// Obtenir la configuration d'un graphique
function get_chart_config(data_chart, title) {
	config = {
		type: 'line',
		data: data_chart,
		options: {
			interaction: {
				intersect: false,
				mode: 'point'
			},
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: title,
					font: {
						weight: 600
					}
				},
				legend: {
					display: true
				},
				tooltip: {
					backgroundColor: 'rgba(43, 43, 43, 0.8)',
					titleFont: {
						weight: 500
					},
					footerFont: {
						weight: 700
					},
					callbacks: {
						title: function(context) {
							return "J" + context[0].label;
						},
						label: function(context) {
							console.log(context)
							let label = '#'
							if (context.parsed.y !== null) {
								label += context.parsed.y + " " + context.dataset.label
							}
							return label;
						}
					}
				}
			},
			scales: {
				x: {
					grid: {
						color: "rgb(26, 26, 26)",
						drawTicks: false,
					}
				},
				y: {
					//suggestedMax: 14,
					display: false,
					min: 0,
					reverse: true,
					ticks: {
						maxTicksLimit: 8,
					},
					grid: {
						titleFont: {
							weight: 200
						},
						color: "rgb(26, 26, 26)",
						drawTicks: false,
					}
				}
			}
		}
	}
	return config
}

// |-----------|
// |   Modal   |
// |-----------|

var modal = document.getElementById("modal");
var button = document.getElementById("modal-button");
var modal_close = document.getElementsByClassName("modal-close")[0];

button.onclick = function() {
	modal.style.display = "block";
}

modal_close.onclick = function() {
	modal.style.display = "none";
}

window.onclick = function(event) {
	if (event.target == modal) {
		modal.style.display = "none";
  	}
}
