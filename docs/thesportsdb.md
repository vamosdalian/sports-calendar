# thesportsdb API docs

## Base Domain

https://www.thesportsdb.com

## Auth

header:
X-API-KEY: 125954

## API

### Full League Season Schedule

/api/v2/json/schedule/league/{leagues}/{season}

param:
 - leagues: leagues id, pl is 4328
 - season: leagues season, in pl like 2024-2025

example:
```
GET https://www.thesportsdb.com/api/v2/json/schedule/league/4328/2025-2026

{
    "schedule": [
        {
            "idEvent": "2267073",
            "strEvent": "Liverpool vs Bournemouth",
            "idLeague": "4328",
            "strLeague": "English Premier League",
            "strSport": "Soccer",
            "strHomeTeam": "Liverpool",
            "strAwayTeam": "Bournemouth",
            "idHomeTeam": "133602",
            "idAwayTeam": "134301",
            "intRound": "1",
            "intHomeScore": "4",
            "intAwayScore": "2",
            "strTimestamp": "2025-08-15T19:00:00",
            "dateEvent": "2025-08-15",
            "dateEventLocal": "2025-08-15",
            "strTime": "19:00:00",
            "strTimeLocal": "20:00:00",
            "strHomeTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png",
            "strAwayTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/y08nak1534071116.png",
            "strVenue": "Anfield",
            "strCountry": "England",
            "strThumb": "https://r2.thesportsdb.com/images/media/event/thumb/67r1br1750320106.jpg",
            "strPoster": "https://r2.thesportsdb.com/images/media/event/poster/3l6tyy1750323149.jpg",
            "strVideo": "https://www.youtube.com/watch?v=0xavu1xwQKg",
            "strPostponed": "no",
            "strFilename": "English Premier League 2025-08-15 Liverpool vs Bournemouth",
            "strStatus": "Match Finished"
        },
        {
            "idEvent": "2267074",
            "strEvent": "Aston Villa vs Newcastle United",
            "idLeague": "4328",
            "strLeague": "English Premier League",
            "strSport": "Soccer",
            "strHomeTeam": "Aston Villa",
            "strAwayTeam": "Newcastle United",
            "idHomeTeam": "133601",
            "idAwayTeam": "134777",
            "intRound": "1",
            "intHomeScore": "0",
            "intAwayScore": "0",
            "strTimestamp": "2025-08-16T11:30:00",
            "dateEvent": "2025-08-16",
            "dateEventLocal": "2025-08-16",
            "strTime": "11:30:00",
            "strTimeLocal": "12:30:00",
            "strHomeTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/jykrpv1717309891.png",
            "strAwayTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/lhwuiz1621593302.png",
            "strVenue": "Villa Park",
            "strCountry": "England",
            "strThumb": "https://r2.thesportsdb.com/images/media/event/thumb/obp08d1750320109.jpg",
            "strPoster": "https://r2.thesportsdb.com/images/media/event/poster/oznkic1750323152.jpg",
            "strVideo": "https://www.youtube.com/watch?v=b9_Rk9Xlz2s",
            "strPostponed": "no",
            "strFilename": "English Premier League 2025-08-16 Aston Villa vs Newcastle United",
            "strStatus": "Match Finished"
        },
        ...
        {
            "idEvent": "2267451",
            "strEvent": "Tottenham Hotspur vs Everton",
            "idLeague": "4328",
            "strLeague": "English Premier League",
            "strSport": "Soccer",
            "strHomeTeam": "Tottenham Hotspur",
            "strAwayTeam": "Everton",
            "idHomeTeam": "133616",
            "idAwayTeam": "133615",
            "intRound": "38",
            "intHomeScore": null,
            "intAwayScore": null,
            "strTimestamp": "2026-05-24T15:00:00",
            "dateEvent": "2026-05-24",
            "dateEventLocal": null,
            "strTime": "15:00:00",
            "strTimeLocal": null,
            "strHomeTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/dfyfhl1604094109.png",
            "strAwayTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/eqayrf1523184794.png",
            "strVenue": "Tottenham Hotspur Stadium",
            "strCountry": "England",
            "strThumb": "https://r2.thesportsdb.com/images/media/event/thumb/bpftko1750321084.jpg",
            "strPoster": "https://r2.thesportsdb.com/images/media/event/poster/307htr1750324307.jpg",
            "strVideo": null,
            "strPostponed": "no",
            "strFilename": "English Premier League 2026-05-24 Tottenham Hotspur vs Everton",
            "strStatus": "Not Started"
        },
        {
            "idEvent": "2267452",
            "strEvent": "West Ham United vs Leeds United",
            "idLeague": "4328",
            "strLeague": "English Premier League",
            "strSport": "Soccer",
            "strHomeTeam": "West Ham United",
            "strAwayTeam": "Leeds United",
            "idHomeTeam": "133636",
            "idAwayTeam": "133635",
            "intRound": "38",
            "intHomeScore": null,
            "intAwayScore": null,
            "strTimestamp": "2026-05-24T15:00:00",
            "dateEvent": "2026-05-24",
            "dateEventLocal": null,
            "strTime": "15:00:00",
            "strTimeLocal": null,
            "strHomeTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/yutyxs1467459956.png",
            "strAwayTeamBadge": "https://r2.thesportsdb.com/images/media/team/badge/jcgrml1756649030.png",
            "strVenue": "London Stadium",
            "strCountry": "England",
            "strThumb": "https://r2.thesportsdb.com/images/media/event/thumb/iejgyx1750321086.jpg",
            "strPoster": "https://r2.thesportsdb.com/images/media/event/poster/1pa5pk1750324309.jpg",
            "strVideo": null,
            "strPostponed": "no",
            "strFilename": "English Premier League 2026-05-24 West Ham United vs Leeds United",
            "strStatus": "Not Started"
        }
    ]
}
```

### Lookup League

/api/v2/json/lookup/league/{leagues}

param:
 - leagues: leagues id, pl is 4328

example:
```
GET https://www.thesportsdb.com/api/v2/json/lookup/league/4328

{
    "lookup": [
        {
            "idLeague": "4328",
            "idAPIfootball": "7293",
            "idAPIfootballv3": "39",
            "strSport": "Soccer",
            "strLeague": "English Premier League",
            "strLeagueAlternate": "Premier League, EPL, England",
            "intDivision": "0",
            "idCup": "0",
            "strCurrentSeason": "2025-2026",
            "intFormedYear": "1992",
            "dateFirstEvent": "1992-08-15",
            "strGender": "Male",
            "strCountry": "England",
            "strWebsite": "www.premierleague.com",
            "strFacebook": "xen-gb.facebook.com/premierleague/",
            "strInstagram": "www.instagram.com/premierleague",
            "strTwitter": "twitter.com/premierleague",
            "strYoutube": "www.youtube.com/channel/UCG5qGWdu8nIRZqJ_GgDwQ-w",
            "strRSS": "https://feeds.bbci.co.uk/sport/football/rss.xml",
            "strDescriptionEN": "The Premier League, often referred to as the English Premier League or the EPL (legal name: The Football Association Premier League Limited), is the top level of the English football league system. Contested by 20 clubs, it operates on a system of promotion and relegation with the English Football League (EFL). Seasons run from August to May with each team playing 38 matches (playing all 19 other teams both home and away). Most games are played on Saturday and Sunday afternoons.\r\n\r\nThe competition was founded as the FA Premier League on 20 February 1992 following the decision of clubs in the Football League First Division to break away from the Football League, founded in 1888, and take advantage of a lucrative television rights sale to Sky. From 2019-20, the league's accumulated television rights deals were worth around £3.1 billion a year, with Sky and BT Group securing the domestic rights to broadcast 128 and 32 games respectively. The Premier League is a corporation where chief executive Richard Masters is responsible for its management, whilst the member clubs act as shareholders. Clubs were apportioned central payment revenues of £2.4 billion in 2016–17, with a further £343 million in solidarity payments to English Football League (EFL) clubs.\r\n\r\nThe Premier League is the most-watched sports league in the world, broadcast in 212 territories to 643 million homes and a potential TV audience of 4.7 billion people. For the 2018–19 season, the average Premier League match attendance was at 38,181, second to the German Bundesliga's 43,500, while aggregated attendance across all matches is the highest of any association football league at 14,508,981. Most stadium occupancies are near capacity. The Premier League ranks first in the UEFA coefficients of leagues based on performances in European competitions over the past five seasons as of 2021. The English top-flight has produced the second-highest number of UEFA Champions League/European Cup titles, with five English clubs having won fourteen European trophies in total.\r\n\r\nFifty clubs have competed since the inception of the Premier League in 1992: forty-eight English and two Welsh clubs. Seven of them have won the title: Manchester United (13), Chelsea (5), Manchester City (5), Arsenal (3), Blackburn Rovers (1), Leicester City (1) and Liverpool (1).",
            "strDescriptionDE": "Die Premier League (offiziell nach dem Sponsoren „Barclays Premier League“, umgangssprachlich „The Premiership“) ist die höchste Spielklasse im englischen Fußball und befindet sich damit auf der obersten Ebene des englischen Ligasystems. Es nehmen momentan 20 Vereine an einer Spielrunde, die zwischen August und Mai des Folgejahres ausgetragen wird, teil. Über eine Auf- und Abstiegsregelung mit dem darunter angesiedelten Football-League-Verband findet jährlich ein Austausch von drei Klubs statt.\r\n\r\nDie am 20. Februar 1992 als „FA Premier League“ gegründete Spielklasse nahm am 15. August desselben Jahres offiziell ihren Spielbetrieb auf. Die Vereine der damaligen Eliteliga First Division profitierten damit erheblich von deutlich erhöhten Fernseheinnahmen und spalteten sich von der Football League ab, die selbst damit die seit 1888 bestehende Vorherrschaft als Plattform für den englischen und walisischen Spitzenfußball verlor. Die Premier League hat sich seitdem zu der Sportliga mit der weltweit höchsten Zuschaueranzahl entwickelt.[1]\r\n\r\nVon den mittlerweile 45 teilnehmenden Vereinen konnten bisher nur fünf Mannschaften die Premier-League-Meisterschaft gewinnen: Manchester United (13 Titel), FC Arsenal (drei Titel), FC Chelsea (drei Titel), Manchester City (zwei Titel) und die Blackburn Rovers (ein Titel). Neben 43 englischen Clubs kommen zwei Premier-Ligisten aus Wales.\r\n\r\nDas Gegenstück im Frauenbereich ist die FA Women’s Premier League (oder genauer die „FA Women's Premier League National Division“), wobei die Vereine dort in mehr oder weniger abhängigen Verbindungen zu den renommierten Klubs im Männerfußball aus der Premier League und der Football League stehen. Dennoch besitzt die Frauenliga einen eher semiprofessionellen Charakter und findet in der Öffentlichkeit im Vergleich zum Männerbereich eine deutlich geringere Resonanz.\r\n\r\nSeit 1999 existiert zudem für die Reserveteams der Profivereine die Premier Reserve League, in der seit der Spielzeit 2006/07 nur Mannschaften der Premier-League-Teilnehmer spielberechtigt sind. Dort kommen neben den Ersatzspielern, die nicht Teil des offiziellen Profikaders sind, vorrangig die jungen Talente der Erstligavereine zum Einsatz.",
            "strDescriptionFR": "Le Championnat d'Angleterre de football est une compétition sportive située au sommet de la hiérarchie du football en Angleterre. Lancée en 1888 par la The Football Association sous le nom de Football League, la compétition laisse place en 1992 à la Premier League, dont le nom officiel est Barclays Premier League depuis 2004.\r\n\r\nLa compétition se déroule annuellement, du mois d'août au mois de mai suivant, sous forme d'un championnat mettant aux prises vingt clubs professionnels, actionnaires de la Premier League, qui disputent chacun 38 matchs. À la fin de la saison, le premier est sacré champion, les suivants sont qualifiés pour les compétitions européennes organisées par l'UEFA tandis que les trois équipes totalisant le plus faible nombre de points sont reléguées en Football League, devenu l'échelon inférieur.\r\n\r\nCe championnat est l'un des plus prestigieux au monde et le plus populaire en termes de téléspectateurs, estimés à plus d'un milliard en 2007. Il est réputé pour être l'un des plus exigeants physiquement pour les joueurs, en raison du calendrier dense, malgré le passage du championnat de 22 à 20 clubs en 1995, et de l'engagement traditionnel du football britannique. La Premier League se place par ailleurs au premier rang européen des championnats au coefficient UEFA de 2008 à 2012, après l'avoir déjà été de 1968 à 1975 et en 1985.\r\n\r\nDepuis 1888, 23 clubs ont remporté le championnat : les plus titrés sont Manchester United (20 titres, sept de Football League et treize de Premier League), Liverpool (18, tous de Football League) et Arsenal (13, dix de Football League et trois de Premier League). Trois autres clubs ont remporté la Premier League depuis 1992 : Chelsea (trois fois), Blackburn Rovers et Manchester City.",
            "strDescriptionIT": "La Premier League è la massima serie del campionato inglese di calcio ed è gestita dalla Football Association (FA).\r\n\r\nSi tratta di un campionato formato da 20 squadre (22 squadre fino al 1995) che non fanno parte della Football League, nato dallo scisma del calcio inglese del 1992.\r\n\r\nAl 2016 la Premier League occupa il secondo posto nel ranking UEFA per competizioni di club.\r\n\r\nAlla massima divisione del campionato inglese partecipano 20 squadre, che si affrontano in un torneo all'Italiana con partite di andata e ritorno. Il regolamento assegna, per ogni incontro, tre punti alla squadra vincitrice, zero punti alla squadra sconfitta ed un punto ad entrambe le formazioni in caso di pareggio.\r\n\r\nAlla squadra prima in classifica dopo le 38 gare di campionato viene assegnato il titolo di campione d'Inghilterra. Unitamente alla seconda ed alla terza classificata, essa accede al tabellone principale della UEFA Champions League, mentre la quarta deve prima passare per il turno di play-off. La quinta in classifica si qualifica alla UEFA Europa League insieme alla squadra vincitrice della FA Cup (fase a gironi) e alla vincitrice della League Cup (terzo turno di qualificazione). Le ultime tre squadre classificate vengono retrocesse in Football League Championship (seconda divisione inglese).",
            "strDescriptionCN": "英格兰足球超级联赛（英语：Premier League），简称英超，過往冠名為巴克萊超級聯賽（Barclays Premier League），是英格蘭足球總會轄下的职业足球联赛，是英格蘭聯賽系統的最高等级联赛，英超由超级联盟负责具体运作，而運作模式為一所以20間球會共同擁有的有限公司。\r\n英格兰超级联赛成立於1992年2月20日，其前身是英格兰甲级联赛(頂級聯賽)。現今英超联赛已經成為世界上最受歡迎以及最受關注的足球聯賽，亦是英格蘭國家隊的少林寺。\r\n英超联赛自1991至1993年成立以來有47支球隊參與競爭，但只有六支奪得冠軍：曼聯（13次），車路士（4次），阿仙奴（3次），曼城（2次），布力般流浪和李斯特城（1次）。\r\n\r\n英格兰超级联赛是收入最高的足球联赛，根據德勤足球俱樂部財富排名榜, 2014–15年 收入最高首 30 名球隊, 英格蘭（英超）已佔了16隊。[1]。而2016–17年 未來3季英國以外地區轉播收入，每季超逾30億英鎊 。淨是未來3季(2016 -2019) 來自 香港 地區轉播收入, 每季已經約1億多美元。而在英國國內還有 BT Sport、 Sky Sports 51.6億鎊直播收入。[2]\r\n\r\n巴克莱银行曾以與超级联赛簽署價值6,580萬英鎊贊助合約3年至2010年 [3]。 2012年7月12日英超賽會宣佈2013/14賽季至2015/16年賽季繼續由巴克莱银行冠名贊助英超，贊助合約以每賽季4000萬英鎊計算即總值1億2000萬英鎊[4]。2016–17年 開始不再實行冠名巴克萊贊助，只作 Premier League 超級聯賽，，而亦進行了品牌改造，品牌標誌、品牌字體將有新面貌[5]。",
            "strFanart1": "https://r2.thesportsdb.com/images/media/league/fanart/odberp1725731801.jpg",
            "strFanart2": "https://r2.thesportsdb.com/images/media/league/fanart/s0ozu31725731959.jpg",
            "strFanart3": "https://r2.thesportsdb.com/images/media/league/fanart/44vpk61725732073.jpg",
            "strFanart4": "https://r2.thesportsdb.com/images/media/league/fanart/grmbt01725731922.jpg",
            "strBanner": "https://r2.thesportsdb.com/images/media/league/banner/xe1es51638921786.jpg",
            "strBadge": "https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png",
            "strLogo": "https://r2.thesportsdb.com/images/media/league/logo/4c377s1535214890.png",
            "strPoster": "https://r2.thesportsdb.com/images/media/league/poster/67al0l1719007596.jpg",
            "strTrophy": "https://r2.thesportsdb.com/images/media/league/trophy/9a6kw51689108793.png",
            "strNaming": "{strHomeTeam} vs {strAwayTeam}",
            "strComplete": "yes",
            "strLocked": "unlocked"
        }
    ]
}
```

### List League Teams

/api/v2/json/list/teams/{leagues}

param:
 - leagues: leagues id, pl is 4328

example:
```
GET https://www.thesportsdb.com/api/v2/json/list/teams/4328

{
    "list": [
        {
            "idTeam": "133599",
            "strTeam": "Wolverhampton Wanderers",
            "strTeamShort": "WOL",
            "strColour1": "#FDB913",
            "strColour2": "#231F20",
            "strColour3": "#FFFFFF",
            "idLeague": "4328",
            "strLeague": "English Premier League",
            "strBadge": "https://r2.thesportsdb.com/images/media/team/badge/u9qr031621593327.png",
            "strLogo": "https://r2.thesportsdb.com/images/media/team/logo/wdes121532295945.png",
            "strBanner": "https://r2.thesportsdb.com/images/media/team/banner/vyxrss1462380950.jpg",
            "strFanart1": "https://r2.thesportsdb.com/images/media/team/fanart/jagant1731852137.jpg",
            "strEquipment": "https://r2.thesportsdb.com/images/media/team/equipment/ms57xh1753438437.png",
            "strCountry": "England"
        },
        {
            "idTeam": "133600",
            "strTeam": "Fulham",
            "strTeamShort": "FUL",
            "strColour1": "#FFFFFF",
            "strColour2": "#000000",
            "strColour3": "#CC0000",
            "idLeague": "4328",
            "strLeague": "English Premier League",
            "strBadge": "https://r2.thesportsdb.com/images/media/team/badge/xwwvyt1448811086.png",
            "strLogo": "https://r2.thesportsdb.com/images/media/team/logo/dk83vs1549368400.png",
            "strBanner": "https://r2.thesportsdb.com/images/media/team/banner/cjl9kv1532296720.jpg",
            "strFanart1": "https://r2.thesportsdb.com/images/media/team/fanart/jv19st1532296431.jpg",
            "strEquipment": "https://r2.thesportsdb.com/images/media/team/equipment/4g9vrt1754037255.png",
            "strCountry": "England"
        },
        ...
        {
            "idTeam": "134777",
            "strTeam": "Newcastle United",
            "strTeamShort": "NEW",
            "strColour1": "#FFFFFF",
            "strColour2": "#241F20",
            "strColour3": "",
            "idLeague": "4328",
            "strLeague": "English Premier League",
            "strBadge": "https://r2.thesportsdb.com/images/media/team/badge/lhwuiz1621593302.png",
            "strLogo": "https://r2.thesportsdb.com/images/media/team/logo/xswxyv1424546917.png",
            "strBanner": "https://r2.thesportsdb.com/images/media/team/banner/71vjhi1499863135.jpg",
            "strFanart1": "https://r2.thesportsdb.com/images/media/team/fanart/wrryur1420579232.jpg",
            "strEquipment": "https://r2.thesportsdb.com/images/media/team/equipment/vw1qr41753264834.png",
            "strCountry": "England"
        }
    ]
}
```