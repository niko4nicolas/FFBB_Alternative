// |-----------------|
// |   Index		 |
// |-----------------|

fetch('./data/championships.json')
	.then((response) => response.json())
	.then((data) => {
		var element_inner_html = ""
		for (o in data) {

			element_inner_html +=
			`
			<div class="title">${data[o].organisation}</div>
			<ul class="list-champ">
			`
			console.log(data[o].organisation)

			for (c in data[o].championships) {
				championship = data[o].championships[c]
				console.log(championship)

				element_inner_html +=
				`
				<li class="list-champ-team">
				<a href="./championship/?champ=${championship.id}">${championship.nom}</a>
				<div class="list-champ-link hidden-on-mobile">
				<object><a href="${championship.lien_championnat}" target="_blank">
					<svg viewBox="0 0 24 24"><path d="M21 3.6v16.8a.6.6 0 01-.6.6H3.6a.6.6 0 01-.6-.6V3.6a.6.6 0 01.6-.6h16.8a.6.6 0 01.6.6z"></path><path d="M15.025 8.025h-4.95m4.95 0v4.95m0-4.95l-3.535 3.536c-2.475 2.475 0 4.95 0 4.95"></path></svg>
				</a></object>
				</div>
				</li>
				`
			}

			element_inner_html +=
			`
			</ul>
			`
		}
		document.getElementById('list-championships').innerHTML = element_inner_html;
	})

// |---------------|
// |   Fonctions   |
// |---------------|

function display_organisation() {

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

