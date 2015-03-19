//
// Netball.js
//
// Jon Brown - Mar 2015
//
// Retrieves netball details
//
// Ideas: Could do a "now playing" page to show the teams that are playing and on what court
//        Build a test call that shows all the teams and their age groups
//        Setup to support all CDNA teams - but how best to do this in the UI? And how to remember your team / login?
//        Heatmap option based on calculated percentage?
//
// 18 Mar 2015 - Better management of busy symbol and "Loading..."
//
// 16 Mar 2015 - Better UI and much faster as it does not reload from CDNA site each time.
//               Force a reload of data - once a week - by clicking on the (c) Copyright message
//
// 13 Mar 2015 - Updated for new fixture
//               Removes "Caulfield South" from team names
//               Hides court number for completed games
//  5 Mar 2015 - Draft version

// These functions are available on both the client and the server ===========================

var greet = function(text) {
    console.log(text);
    if(Meteor.isClient) {
        if (Session.get("S-Debug")) Session.set("S-Greet", text); // If Debug is on, show status message
    }
}

var isToday = function(date) { // Utility function to see if passed date (dd Mmm) is the same as today
    var d = new Date();
    var t = d.toString();
    var mmm = t.substring(4,7); // Month
    var dd = t.substring(8,10); // Day
    var today = dd + " " + mmm;
    if (date == today) return true;
    return false;
}
    
Netball = new Mongo.Collection("Netball");
    
// Everything in here is only run on the server ==============================================

if(Meteor.isServer) {
    greet(">>> Netball server is alive");

  Meteor.publish("netball", function () {
    return Netball.find();
  });
      
  Meteor.methods({
    
    getGames: function(team, gradeID) { // Looks up this team's details - Need Cheerio ie $meteor add mrt:cheerio
//        this.unblock();
        greet("Finding games for " + team + " grade " + gradeID);
        
//      The url below is found by trial and error. Seems to be no way to deduce it.
//      Currently using hard coded gradeID for all supported teams (Legends and Hummers)

//      2015 Legends: seasonid=94&entityid=39427&gradeid=5802
//      2015 Hummers: same but gradeid=5814

        var url = "http://cdna.vic.netball.com.au/common/pages/public/rv/draw.aspx?seasonid=94&entityid=39427&gradeid=" + gradeID;
        
        greet("URL:" + url);
        var result = HTTP.call("GET", url);
        var content = result.content;
        greet("Content length:" + content.length);
//        greet("#################");
//        greet(content);
//        greet("#################");
        
//      greet("About to load into Cheerio...");
        var $ = cheerio.load(content);
        greet("Loaded into Cheerio...");
        var count = 0;
        
//      CHHERIO DOCUMENTATION HERE: https://github.com/cheeriojs/cheerio (scroll down)

        var search = "td:contains('" + team + "')";
        greet("Searching for " + team);
        $(search).each(function(i, row)
//      $("td:contains('Caulfield South Legends')").each(function(i, row)
        {
/*
  <tr class="fixtureRow">
    <td>13 Feb 15 6:20PM</td>
    <td class="e40662">Caulfield South Legends</td>
    <td align="center" nowrap="true">&nbsp;<a href="match.aspx?matchID=2014613&amp;entityID=39427">10&nbsp;<b>def</b>&nbsp;0</a>&nbsp;</td>
    <td class="e40661">Carnegie Cannons</td>
    <td>
    <a href="javascript:;" onclick="javascript:sh_ven(5592,39427,1);" title="Court 4">Court 4</a>&nbsp;</td>
*/
          if (count == 0)
          {
            greet("Skipping first entry");
          }
          else
          {
           var gameDate = $(this).siblings().first().text();
           var team1 = $(this).siblings().next().text(); 
//    <td align="center" nowrap="true">&nbsp;<a href="match.aspx?matchID=2014613&amp;entityID=39427">10&nbsp;<b>def</b>&nbsp;0</a>

            var result = $(this).siblings().next().next().toString();
            var txt = result.split("entityID=")[1]; // The bit after entityID
            
            var txt2;
            var txt3;
            var team1Score = "";
            var team2Score = "";
            var team2 = "";
            var court = "";
            var courtNum = "";
            var gameTime = "";
            var gameDay = "";
                        
//          If txt is null then it's a bye
            if (team1 === "Bye")
            {
              greet("BYE TYPE 1 FOUND");
              gameDay = gameDate.split(" ")[0]+" "+gameDate.split(" ")[1]; // Only DD MMM
              bye = true;
            }
            else 
            {            
              team2 = $(this).siblings().next().next().next().text();
              if (team2 === "Bye") {
                greet("BYE TYPE 2 FOUND");
                gameDay = gameDate.split(" ")[0]+" "+gameDate.split(" ")[1]; // Only DD MMM
                team2 = "";
                team1 = "Bye"; // So all Byes are of the same form
              }
              else
              {
//                if (team2.indexOf("Caulfield South Legends") == 0) team2 = "Legends";
                 txt2 = txt.split(">")[1];           // and after the >
                 txt3 = txt2.split("<b>")[0];        // but before the <b>
                 team1Score = txt3.split("&")[0];    // but before the &nbsp;
            
                 txt2 = txt.split("</b>")[1];        // After the </b>
                 txt3 = txt2.split("</a>")[0];       // Before the </a>
                 team2Score = txt3.split("sp;")[1];  // but after the &nbsp;
 
                 court = $(this).siblings().next().next().next().next().text();
                 courtNum = court.substr(court.length-2,1);
                 gameTime = gameDate.split(" ")[3];   // 6:20PM
                 gameTime = gameTime.split(/[AP]/)[0] // PArt before the AM/PM
                 gameDay = gameDate.split(" ")[0]+" "+gameDate.split(" ")[1]; // Only DD MMM
              }
            }
//          If there's a score then set the court to blank as game has been played
            if (team1Score != "") courtNum = "";
            greet("Round " + count + ") " + gameDay + "/" + gameTime + "/" + team1 + "/" + team1Score + "::" + team2Score + "/" + team2 + "/" + courtNum + "/");
            Netball.insert({
              gameDay: gameDay, gameTime: gameTime, Team1: team1, Team2: team2, Court: courtNum, Score1: team1Score, Score2: team2Score,
              createdAt: new Date() // current time
            });
          }
          count++;
        }); // S()
        return count-1; // Ignore the first one
    }, // getStockNews
    
    KillNetball: function(){ // Only for testing!!
      greet("\nKilling all netball!");
      var toKill = Netball.find({}, {reactive: false}).fetch();
      var count = 0;
      for (var i in toKill)
      {
        count++;
        greet(count + ") Deleting " + toKill[i].gameDay + ", id:" + toKill[i]._id);
        Netball.remove(toKill[i]._id);
      }
      return count;
    } // KillNetball
  });
} // isServer

// Everything in here is only run on the client ==============================================

if(Meteor.isClient) {
    Session.set("S-busy", 'Y'); // On startup assume we're busy
    
    Meteor.subscribe("netball", function() {
//      Callback...
        Session.set("S-busy", 'N'); // Assume we're not busy now    
    });
    
    Meteor.startup(function () {
        greet("Client is alive");
                    
    }); // Client startup

//  ========================    
    Template.games.helpers({
//  ========================    
    
    tTeam: function () {
//    Only shows the opposition team
      var team1 = this.Team1;
      var team2 = this.Team2;
      if (Session.get("S-team") == team1) {
        return team2; // Don't show selected team name
      }
      return team1;      
    },

    tgameTime: function () {
      var team1 = this.Team1;
      if (Session.get("S-team") == team1) {
//      Home game so add a space as there will be an icon there
        return " "+this.gameTime;
      }
      return this.gameTime;
    },

    tgameHome: function () {
//    Show a home icon if it's a home game
      var team1 = this.Team1;
      if (Session.get("S-team") == team1) {
//      Home game so show it (if there's no result yet ie game has not been played)
        if (this.Score1 =="") {
          return "glyphicon glyphicon-home"; 
        }
        return ""; 
      }
      return "";
    },
    
    tResultColour: function () {
      if (this.Court > 0) return "black"; //    If there's a court number there's no result
//    Shows the result with selected team first
      var s1 = parseInt(this.Score1);
      var s2 = parseInt(this.Score2);
      if (Session.get("S-team") == this.Team1) { // Home game
        if (s1 >= s2) return "green"; // Win
        return "red"; // Loss
      }
      // Away game
      if (s2 >= s1) return "green"; // Win
      return "red"; // Loss 
    },
    
    tCourt_or_Result: function () {
      if (this.Court > 0) return this.Court; //    If there's a court number there's no result

//    Shows the result with selected team first
      var s1 = parseInt(this.Score1);
      var s2 = parseInt(this.Score2);
      if (Session.get("S-team") == this.Team1) {
        return s1 + "-" + s2; // Normal result order as was a home game
      }
      // Away game
      return s2 + "-" + s1; // Reverse order for away result  
    }

  });  // Template.games.helpers
    
//  ========================    
    Template.body.helpers({
//  ========================    
           
    BusySymbol: function () { // Show a busy graphic if we are
        if (!Session.get("S-busy")) return "busy.gif"; // Starting up...
        
        if (Session.get("S-busy") != 'N') {
          return "busy.gif"; // "Loading data...";
        } else {
          return "blank.gif"; // Nothing (ie not busy)
        }
    },
    
    TeamName: function () {
      if (!Session.get("S-busy")) return "Starting up"; // Starting up...
      if (Session.get("S-busy") != 'N') return "Loading games...";
      if (!Session.get("S-short")) return 'Please select a team'; // Starting up
      return Session.get("S-short") + ' Fixture and Results';      
    },
    
    netball: function () {
    // return all the stocks - sorted as we want
    // To sort by date: {sort: {createdAt: -1}});
    
//    Day: gameDay, gameTime: gameTime, Team1: team1, Team2: team2, Court: courtNum, Score1: team1Score, Score2: team2Score
      return Netball.find({ $or: [ { "Team1" : { $in : [ Session.get("S-team") ] } } , { "Team2" : { $in : [ Session.get("S-team") ] } } ] } );
    }
  });  // Template.body.helpers
    
//  ========================    
  
//  ========================    
    Template.body.events({
//  ========================    

// 2015 Legends: seasonid=94&entityid=39427&gradeid=5802
// 2015 Hummers: same but gradeid=5814
//
/* ########################
// TO FIND THE gradeid, do this:
//
// 1. Go to CDNA -> Fixtures eg http://cdna.vic.netball.com.au/common/pages/public/rv/draw.aspx?entityid=39427&
// 2. View source
// 3. Find the section with the code for the drop-down. For example:
<option value="5802_1">-11 &amp; Under Section 1</option>
<option value="5804_1">-11 &amp; Under Section 2</option>
<option value="5805_1">-11 &amp; Under Section 3</option>
<option value="5806_1">-11 &amp; Under Section 4</option>
<option value="5874_1">-11 &amp; Under Section 5</option>
<option value="5875_1">-11 &amp; Under Section 6</option>
<option value="14852_1">-11 &amp; Under Section 7</option>
<option selected="selected" value="5807_1">-13 &amp; Under Section 1 - 2</option>
<option value="5809_1">-13 &amp; Under Section 3</option>
<option value="5810_1">-13 &amp; Under Section 4</option>
<option value="5811_1">-13 &amp; Under Section 5</option>
<option value="14857_1">-13 &amp; Under Section 6</option>
<option value="5812_1">-15 &amp; Under Section 1</option>
<option value="5813_1">-15 &amp; Under Section 2</option>
<option value="5814_1">-15 &amp; Under Section 3</option>
<option value="5815_1">-15 &amp; Under Section 4</option>
<option value="5816_1">-15 &amp; Under Section 5</option>
<option value="5817_1">-17 &amp; Under Section 1</option>
<option value="5818_1">-17 &amp; Under Section 2</option>
<option value="5819_1">-17 &amp; Under Section 3</option>
<option value="10871_1">-17 &amp; Under Section 4</option>
<option value="5821_1">-25 &amp; Under Section 1</option>
<option value="5822_1">-25 &amp; Under Section 2</option>
<option value="10872_1">-25 &amp; Under Section 3</option>
// 4. Notice the nnnn_l that corresponds to what team you want
// (eg in 2015, Sophie (Legends) was in Under 11 Section 1 = 5802_l)
// 5. The gradeid is nnnn
//
// ########################*/

    "click .refresh": function () {
      // Reloads game details
      Session.set("S-busy", 'Y');
      Meteor.call('KillNetball', function (err, data) {
          if (err) {
            greet("Kill FAILED");
            return;
          }
          greet("Killed " + data + " OK");
        });
      Session.set("S-team", null);
      Session.set("S-code", null);
      Session.set("S-short",null);

      var team = "Caulfield South Hummers";
      var gradeid = "5814";
      greet("Calling getGames for " + gradeid + " (" + team + ")");
      Meteor.call('getGames', team, gradeid, function (err, data) {
          if (err) greet("getGames FAILED");
          else greet("getGames returned " + data + " games OK");
        });
      team = "Caulfield South Legends";
      gradeid = "5802";
      Meteor.call('getGames', team, gradeid, function (err, data) {
          if (err)
            {
              greet("getGames FAILED");
              Session.set("S-busy", 'N');
            }
          else
            {
              greet("getGames returned " + data + " games OK");
              Session.set("S-busy", 'N');
            }

        });
    }, // refresh
    
    "click .refresh1": function () {
      // Reloads game details
      /*
      Meteor.call('KillNetball', function (err, data) {
          if (err) {
            greet("Kill FAILED");
            return;
          }
          greet("Killed " + data + " OK");
        });*/
      Session.set("S-busy", 'N');
      Session.set("S-team", "Caulfield South Hummers");
      var words = Session.get("S-team").split(" ");
      greet("Words:" + words);
      Session.set("S-short",words[(words.length)-1]);
      Session.set("S-code", "5814"); // This will be found from a call eventually
      /*
      greet("Calling getGames for " + Session.get("S-short"));
      Meteor.call('getGames', Session.get("S-team"), Session.get("S-code"), function (err, data) {
          if (err) greet("getGames FAILED");
          else greet("getGames returned " + data + " games OK");
        });
      */
    }, // refresh1

    "click .refresh2": function () {
      // Reloads game details
      /*
      Meteor.call('KillNetball', function (err, data) {
          if (err) {
            greet("Kill FAILED");
            return;
          }
          greet("Killed " + data + " OK");
        }); */
      Session.set("S-busy", 'N');
      Session.set("S-team", "Caulfield South Legends");
      var words = Session.get("S-team").split(" ");
      greet("Words:" + words);
      Session.set("S-short",words[(words.length)-1]);
      Session.set("S-code", "5802"); // This will be found from a call eventually
      /*
      Meteor.call('getGames', Session.get("S-team"), Session.get("S-code"), function (err, data) {
          if (err) greet("getGames FAILED");
          else greet("getGames returned " + data + " games OK");
        });
      */
    } // refresh2
    
  }); // Template.body.events
  
//  ========================         

} //is Client
