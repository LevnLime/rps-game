var currentPlayerKey;
window.addEventListener("DOMContentLoaded", pageLoaded);
window.addEventListener("unload", quitGame);

function pageLoaded(event) {
    // Add event handlers
    joinButton = document.getElementById("joinGameButton");
    joinButton.addEventListener("click", joinGameClick);
    document.getElementById("quitGameButton").addEventListener("click", quitGame);
}

function setMenuMessage(message) {
    messageBox = document.getElementById("menuMessage");
    messageBox.innerText = message;
}

function joinGameClick(event) {
    // Don't do anything if we've already joined a game
    if (currentPlayerKey) {
        return;
    }

    firebase.database().ref("/players").once("value").then(function(snapshot) {
        var playerName = document.getElementById("playerName").value;
        if (snapshot.exists()) {
            // There are players. How many?
            var numPlayers = Object.keys(snapshot.val()).length;
            if (numPlayers == 1) {
                // We can join the game
                addPlayerToGame();
            } else {
                // Already 2 or more players. Don't join
                setMenuMessage("Already two players. Not joining");
            }

        } else {
            // No players yet
            addPlayerToGame();
        }
    });
}

function addPlayerToGame() {
    if(!currentPlayerKey) {
        var playerName = document.getElementById("playerName").value;
        var newPlayer = firebase.database().ref("/players").push();
        newPlayer.set({
            name: playerName
        });
        currentPlayerKey = newPlayer.key;
        setMenuMessage("Joined game");

        // Listen for players to arrive
        firebase.database().ref("/players").on("value", onPlayerChanged);
    }
}

function quitGame() {
    if (currentPlayerKey) {
        firebase.database().ref(`/players/${currentPlayerKey}`).remove();
        currentPlayerKey = undefined;
        setMenuMessage("Quit");

        // Cleanup firebase listeners
        firebase.database().ref("/players").off();
    }
}

// Called when the /players node changes
function onPlayerChanged(snapshot) {
    var numPlayers = Object.keys(snapshot.val()).length;
    if (numPlayers == 1) {
        setMenuMessage("Waiting on another player...");
    } else if (numPlayers == 2) {
        setMenuMessage("Start game!");
        startGame();
    } else {
        // This shouldn't happen
        console.log("More than 2 players joined?!");
        debugger;
    }
}

function startGame() {

}