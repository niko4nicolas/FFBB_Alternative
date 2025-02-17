// |--------------|
// |   Chart.js   |
// |--------------|

Chart.defaults.font.size = 14
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
Chart.defaults.font.weight = 400
Chart.defaults.font.lineHeight = "1.4em"

// |------------|
// |   Équipe   |
// |------------|

page_championship_id = localStorage.getItem("selected_championship_id")

if (null == page_championship_id) {
	link_previous = '../'
}
else {
	link_previous = '../championship/?champ='+page_championship_id
}

document.getElementsByClassName('header-back')[0].setAttribute('href', '../championship/?champ='+page_championship_id)

/* Création d'un numéro de version qui change toutes les 1000s (environ 16 min)
    pour forcer à recharger le json */
let version = Date.now().toString().slice(0, -6)

fetch('../data/'+page_championship_id+'.json?v='+version)
	.then((response) => response.json())
	.then((data) => {
		// Informations du championnat
		document.getElementsByClassName('header-subtitle')[0].innerHTML = data.nom // Nom du championnat

		// Chargement de la poule sélectionnée
		selected_pool_name = localStorage.getItem("selected_pool_name")
		if (!selected_pool_name) {
			localStorage.setItem("selected_pool_name", pools[0].poule);
			selected_pool_name = pools[0].poule
		}

		selected_pool = data.poules[0] // choisir une poule par défaut
		for (p in data.poules) {
			pool_name = data.poules[p].poule
			if (pool_name == selected_pool_name) {
				selected_pool = data.poules[p] // choisir la poule sélectionnée
			}
		}

		selected_club_name = localStorage.getItem("selected_club_name")
		// Recherche de l'équipe à afficher
		page_club_name = window.location.search
		page_club_name = new URLSearchParams(page_club_name).get('club')
		if (!page_club_name) {
			page_club_name = selected_club_name
		}

		document.getElementsByClassName('header-title')[0].innerHTML = page_club_name // Nom de l'équipe sélectionnée

		// Retirer les matchs à ne pas afficher
		keep_home_games = !document.getElementById("exterieur").checked
		keep_away_games = !document.getElementById("domicile").checked
		filtered_games = filter_games(selected_pool.rencontres, page_club_name, keep_home_games, keep_away_games)

		previous_fixtures = []
		next_fixtures = []
		for (g in filtered_games) {
			if (filtered_games[g].match_joue == true) {
				previous_fixtures.push(filtered_games[g])
			}
			else {
				next_fixtures.push(filtered_games[g])
			}
		}
		// Afficher les résultats d'une équipe
		display_fixtures(previous_fixtures, 'results_fixtures', selected_club_name, page_club_name, true, true)
		// Afficher le calendrier d'une équipe
		display_fixtures(next_fixtures, 'calendar_fixtures', selected_club_name, page_club_name, true, true)

		// Récupérer les statistiques
		stats_data = compute_stats(page_club_name, filtered_games)

		// Afficher les statistiques de l'équipe
		display_stats(stats_data)

		/* Construire et afficher les données sur le graphiques */
		compute_and_display_graph_data(page_club_name, filtered_games)

		// Changement de mode des graphiques
		document.getElementById("divide").addEventListener("click", () => display_charts(matchday_data, points_scored_data, points_cashed_data, opponents_teams_data))
		document.getElementById("combine").addEventListener("click", () => display_charts(matchday_data, points_scored_data, points_cashed_data, opponents_teams_data))

		document.getElementById("tous").addEventListener("click", () => location.reload())
		document.getElementById("domicile").addEventListener("click", () => location.reload())
		document.getElementById("exterieur").addEventListener("click", () => location.reload())
		
		schedule_ics = build_ics_schedule(page_club_name, filtered_games)

		document.getElementById("download-schedule").addEventListener("click", () => download_schedule(schedule_ics, 'calendrier.ics'))
	})


// |---------------|
// |   Fonctions   |
// |---------------|

function compute_and_display_graph_data(page_club_name, filtered_games) {		
	// Réupération des données pour les graphiques
	matchday_data = []
	points_scored_data = []
	points_cashed_data = []
	opponents_teams_data = []
	for (g in filtered_games) {
		fixture = filtered_games[g]
		if (fixture.match_joue == true) {
			matchday_data.push(fixture.jour)
			home_squad = get_div_squad(fixture.equipe_domicile_numero)
			away_squad = get_div_squad(fixture.equipe_exterieur_numero)
			
			if (page_club_name == fixture.club_domicile) {
				points_scored_data.push(fixture.resultat_equipe_domicile)
				points_cashed_data.push(fixture.resultat_equipe_exterieur)
				opponents_teams_data.push(fixture.club_exterieur + away_squad)
			} else {
				points_scored_data.push(fixture.resultat_equipe_exterieur)
				points_cashed_data.push(fixture.resultat_equipe_domicile)
				opponents_teams_data.push(fixture.club_domicile + home_squad)
			}
		}
	}

	// Affichage des graphiques des points
	display_charts(matchday_data, points_scored_data, points_cashed_data, opponents_teams_data)
}

/**
 * Returns a hash code from a string
 * 
 * @param  {String} str The string to hash
 * 
 * @return {Number} A 32bit integer
 */
function hash_string(str) {
	let hash = 0;
	for (let i = 0, len = str.length; i < len; i++) {
		let chr = str.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	hash = hash.toString(16).toUpperCase().replace(/-/g, '')
	return hash;
}

function compute_ics_event_date(date, heure) {
	/* Conversion de la date pour être accepté lors de la création de l'objet Date */
	date_parts = date.split("/");
	date_yyyymmdd = date_parts[2] + '-' + date_parts[1] + '-' + date_parts[0];
	event_date = new Date(date_yyyymmdd + " " + heure)
	/* L'objet date redéfini l'heure en UTC, il faut la reconvertir en heure locale */
	event_date = event_date.toLocaleString('sv').replace(' ', 'T');
	event_date = event_date.replace(/[-:]/g, '')
	event_date = event_date.slice(0, 15)
	return event_date
}

function build_ics_schedule(page_club_name, filtered_games) {
	nb_events = 0

	eof = `\r\n`
	ics_data = `BEGIN:VCALENDAR${eof}`
	ics_data += `VERSION:2.0${eof}`
	ics_data += `PRODID:-//FFBB//Alternative interface//FR${eof}`
	for (g in filtered_games) {
		fixture = filtered_games[g]

		if(false == fixture.match_joue) {
			nb_events++
			ics_data += `BEGIN:VEVENT${eof}`
			ics_data += `SUMMARY:${fixture.club_domicile} contre ${fixture.club_exterieur}${eof}`
			/* CHECKME: l'uid est créé avec les données de la rencontre mais uid différent pour
				une même rencontre si changement d'horaire ou de date. Est-ce correct ? */
			event_uid = hash_string(JSON.stringify(fixture))
			ics_data += `UID:${event_uid}${eof}`
			event_date = compute_ics_event_date(fixture.date, fixture.heure)
			ics_data += `DTSTART;TZID=Europe/Paris:${event_date}${eof}`
			ics_data += `DURATION:PT2H${eof}`
			ics_data += `END:VEVENT${eof}`
		}
	}
	ics_data += `END:VCALENDAR${eof}`

	if (0 == nb_events) {
		ics_data = null
	}

	return ics_data
}

download_schedule = (function () {
	a = document.createElement("a")
	document.body.appendChild(a)
	a.style = "display: none"
	return function (data, filename) {
		blob = new Blob([data], {type: "octet/stream"})
		url = window.URL.createObjectURL(blob)
		a.href = url
		a.download = filename
		a.click()
		window.URL.revokeObjectURL(url)
	};
}());

function compute_stats(club_name, games) {
	stats_data = {
		'points de différence': 0,
		'points marqués': 0,
		'points encaissés': 0,
		'points de différence en moyenne': 0,
		'points marqués en moyenne': 0,
		'points encaissés en moyenne': 0,
	}
	nb_game_played = 0
	for (g in games) {
		fixture = games[g]
		if ( true == fixture.match_joue )
		{
			nb_game_played++
			if ( club_name == fixture.club_domicile ) {
				stats_data['points marqués'] += fixture.resultat_equipe_domicile
				stats_data['points encaissés'] += fixture.resultat_equipe_exterieur
				stats_data['points de différence'] += (fixture.resultat_equipe_domicile - fixture.resultat_equipe_exterieur)
			}
			else if ( club_name == fixture.club_exterieur ) {
				stats_data['points marqués'] += fixture.resultat_equipe_exterieur
				stats_data['points encaissés'] += fixture.resultat_equipe_domicile
				stats_data['points de différence'] += (fixture.resultat_equipe_exterieur - fixture.resultat_equipe_domicile)
			}
		}
	}

	if ( 0 < nb_game_played ) {
		stats_data['points marqués en moyenne'] = (stats_data['points marqués'] / nb_game_played).toFixed(2)
		stats_data['points encaissés en moyenne'] = (stats_data['points encaissés'] / nb_game_played).toFixed(2)
		stats_data['points de différence en moyenne'] = (stats_data['points de différence'] / nb_game_played).toFixed(2)
	}

	return stats_data
}

function display_stats(stat_data) {
	for (stat in stat_data) {
		if (stat == 'points marqués' || stat == 'points marqués en moyenne') {
			stat_trend_icon = '<svg viewBox="0 0 24 24"><path class="stat-trend-up" d="M16 20v-8m0 0l3 3m-3-3l-3 3M4 14l8-8 3 3 5-5"></path></svg>'
		} else if (stat == 'points encaissés' || stat == 'points encaissés en moyenne') {
			stat_trend_icon = '<svg viewBox="0 0 24 24"><path class="stat-trend-down" d="M4 10l8 8 3-3 5 5M16 4v8m0 0l3-3m-3 3l-3-3"></path></svg>'
		} else {
			stat_trend_icon = '<svg viewBox="0 0 24 24"><path d="M9 21h6m-6 0v-5m0 5H3.6a.6.6 0 01-.6-.6v-3.8a.6.6 0 01.6-.6H9m6 5V9m0 12h5.4a.6.6 0 00.6-.6V3.6a.6.6 0 00-.6-.6h-4.8a.6.6 0 00-.6.6V9m0 0H9.6a.6.6 0 00-.6.6V16"></path></svg>'
		}
		document.getElementsByClassName('stats')[0].innerHTML +=
		`
			<div class="stat">
			<div class="stat-trend">${stat_trend_icon}</div>
			<div class="stat-infos">
				<div class="stat-figure">${stat_data[stat]}</div>
				<div>${stat}</div>
			</div>
			</div>
		`
	}
}

// Obtenir la configuration d'un graphique
function get_chart_config(data_chart, title, opponents_teams) {
	config = {
		type: 'line',
		data: data_chart,
		options: {
			interaction: {
				intersect: false,
				mode: 'index'
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
					display: false
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
						title: (tooltipItems) => {
							tooltipItems.forEach(function(tooltipItem) {
								index = tooltipItem.dataIndex.toString()
							})
							return opponents_teams[index]
						},
						label: () => {''},
						footer: (tooltipItems) => {
							let points = []
							tooltipItems.forEach(function(tooltipItem) {
								points.push(tooltipItem.parsed.y)
							})
							if (points[1]) {
								gap = points[0] - points[1]
							} else {
								gap = points[0]
							}
							return gap
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
					suggestedMax: 160,
					min: 0,
					ticks: {
						maxTicksLimit: 9
					},
					grid: {
						titleFont: {
							weight: 600
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

// Afficher les graphiques
function display_charts(day_data, points_scored_data, points_cashed_data, opponents_teams) {
	if (document.getElementById('divide').checked) {
		document.getElementsByClassName('charts')[0].innerHTML = 
		`
			<div class="chart">
				<canvas id="points_scored"></canvas>
			</div>
			<div class="chart">
				<canvas id="points_cashed"></canvas>
			</div>
		`
		const ctx1 = document.getElementById('points_scored')
		const ctx2 = document.getElementById('points_cashed')
		const data_chart1 = {
			labels: day_data,
			datasets: [{
				data: points_scored_data,
				backgroundColor: 'rgba(29, 187, 121, 0.2)',
				borderColor: 'rgb(29, 187, 121)',
				borderWidth: 1,
				fill: true,
				pointRadius: 6
			}]
		}
		const data_chart2 = {
			labels: day_data,
			datasets: [{
				data: points_cashed_data,
				backgroundColor: 'rgba(255, 47, 84, 0.2)',
				borderColor: 'rgb(255, 47, 84)',
				borderWidth: 1,
				fill: true,
				pointRadius: 6
			}]
		}
		config1 = get_chart_config(data_chart1, "Points marqués", opponents_teams)
		config2 = get_chart_config(data_chart2, "Points encaissés", opponents_teams)
		new Chart(ctx1, config1)
		new Chart(ctx2, config2)
	} else if (document.getElementById('combine').checked) {
		document.getElementsByClassName('charts')[0].innerHTML =
		`
			<div class="chart">
				<canvas id="points"></canvas>
			</div>
		`
		const ctx = document.getElementById('points')
		const data_chart = {
			labels: day_data,
			datasets: [
				{
					data: points_scored_data,
					backgroundColor: 'rgba(29, 187, 121, 0.2)',
					borderColor: 'rgb(29, 187, 121)',
					borderWidth: 1,
					pointRadius: 3
				},
				{
					data: points_cashed_data,
					backgroundColor: 'rgba(255, 47, 84, 0.2)',
					borderColor: 'rgb(255, 47, 84)',
					borderWidth: 1,
					fill: {target: '0', above: 'rgba(255, 47, 84, 0.2)', below: 'rgba(29, 187, 121, 0.2)'},
					pointRadius: 3
				}
			]
		}
		config = get_chart_config(data_chart, "Différence de points", opponents_teams)
		new Chart(ctx, config)
	}
}
