// |--------------|
// |   Chart.js   |
// |--------------|

Chart.defaults.font.size = 14
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
Chart.defaults.font.weight = 400
Chart.defaults.font.lineHeight = "1.4em"


// |-------------------|
// |   Développement   |
// |-------------------|

fetch('../data/data.json')
	.then((response) => response.json())
	.then((data) => {

		pools = data.poules

		// Chargement de la poule sélectionnée
		selected_pool_name = localStorage.getItem("selected_pool_name")
		if (!selected_pool_name) {
			localStorage.setItem("selected_pool_name", pools[0].poule);
			selected_pool_name = pools[0].poule
				}

		pool_selection_index = 0
		// Affichage des équipes dans la sélection
		for (p in pools) {
			pool_name = pools[p].poule
			selected = ''
			if (pool_name == selected_pool_name) {
				pool_selection_index = p
				selected = 'selected'
			}
		}

		selected_pool = pools[pool_selection_index] // choisir la poule sélectionnée

		// Mise à jour du nom de poule
		document.getElementsByClassName('ranking-pool')[0].innerHTML = selected_pool.poule

		// Toutes les rencontres de la poule
		games = selected_pool.rencontres
		// Toutes les équipes de la pôule
		teams = selected_pool.equipes

		// Détermination de la prochaine journée avec des matchs à jouer
		next_matchday = compute_next_matchday(games)
		
		// Affichage journée
		document.getElementsByClassName('ranking-pool')[0].innerHTML += ` JOURNEE ${next_matchday-2}`

		// Précédent classement : prochaine journée - 2)
		ranking = compute_ranking_until_matchday(teams, games, next_matchday-2)

		// Affichage du classement précédent 
		for (team in ranking) {
			document.getElementById("former_ranking").innerHTML +=
			`
			<li class="ranking-team">
				<a href="#">
					<div class="ranking-rank">${parseInt(team) + 1}</div>
					<div class="ranking-icon">
						<svg width="8" height="8" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" stroke="rgb(184, 184, 184)" stroke-width="16"/></svg>
					</div>
					<div class="ranking-name">
						<div class="ranking-club">${ranking[team][0]}</div>
					</div>
					<div class="hidden-on-mobile"></div>
					<div class="hidden-on-mobile"></div>
					<div class="hidden-on-mobile"></div>
					<div class="hidden-on-mobile"></div>
					<div class="hidden-on-mobile"></div>
					<div></div>
					<div></div>
					<div class="ranking-points">${ranking[team][1]}</div>  
				</a>
			</li>
			`
		}

		// Calculer le nombre de journées total
		matchday_counter = compute_nb_matchdays(games)

		/* Evolution du classement */
		ranking_history = compute_ranking_history(teams, games, matchday_counter)

		display_ranking_evolution(ranking_history)
	})

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
