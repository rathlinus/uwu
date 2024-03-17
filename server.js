const e = require("express");
const express = require("express");
const http = require("http");
const { emit } = require("process");
const { start } = require("repl");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

let games = {};

app.get("/game/:gameId", (req, res) => {
  const gameId = req.params.gameId;

  if (games[gameId]) {
    //idle for half a second

    if (games[gameId].players.length >= 4) {
      console.log("Game is full");
      res.redirect("/");
    } else {
      res.sendFile(__dirname + "/public/game.html");
    }
  } else {
    games[gameId] = {
      players: [],
      currentPlayerIndex: 0,
      deck: [],
      currentCard: null,
      cardstodraw: 0,
      direction: 1,
      statistics: {
        totalCardsPlayed: 0,
        specialCardsPlayed: 0,
        wins: [],
        //current time to calculate game time later
        time: new Date().getTime(),
      },
    };
    res.sendFile(__dirname + "/public/game.html");
  }
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/lobby.html");
});

io.on("connection", (socket) => {
  refreshGamesList();

  socket.on("createGame", () => {
    const gameId = generategameId();
    games[gameId] = {
      players: [socket],
      currentPlayerIndex: 0,
      deck: [],
      currentCard: null,
      cardstodraw: 0,
      direction: 1,
      statistics: {
        totalCardsPlayed: 0,
        specialCardsPlayed: 0,
        wins: [],
        time: new Date().getTime(),
      },
    };
    socket.currentGameId = gameId; // Store gameId on the socket object
    socket.emit("gameCreated", gameId);
  });

  socket.on("joinGame", (gameId) => {
    if (games[gameId] && games[gameId].players.length < 4) {
      //check if player is already in the game

      games[gameId].players.push(socket);
      socket.currentGameId = gameId; // Store gameId on the socket object
      socket.emit("joinedGame", gameId);
      console.log(`Player joined game with ID: ${gameId}`);

      startGame(gameId);
    } else {
      socket.emit(
        "error",
        "Unable to join game: Invalid game ID or game is full."
      );
    }
  });

  socket.on("startGame", (gameId, username) => {
    //add username to player
    const playerIndex = games[gameId].players.findIndex((s) => s === socket);
    games[gameId].players[playerIndex].username = username;

    let everyonehasusername = true;
    // to start every user must have a username
    games[gameId].players.forEach((player) => {
      if (!player.username) {
        console.log("Not all players have a username");
        everyonehasusername = false;
      }
    });

    if (everyonehasusername) {
      startGame(gameId, "start");
    } else {
      emitusernamelist(gameId);
    }
  });

  socket.on("disconnect", () => {
    const gameId = socket.currentGameId;
    if (gameId && games[gameId]) {
      const game = games[gameId];
      game.players = game.players.filter((player) => player !== socket);
    }
    refreshGamesList();

    if (gameId && games[gameId].players.length === 0) {
      delete games[gameId];
      return;
    }
    //if gameid is undefined, the player is in the lobby
    if (!gameId) {
      return;
    }
    emitusernamelist(gameId);
  });

  socket.on("playCard", (card) => {
    const currentGameId = socket.currentGameId; // Retrieve the currentGameId from the socket
    if (!currentGameId || !games[currentGameId]) return;
    const game = games[currentGameId];
    const playerIndex = game.players.findIndex((s) => s === socket);

    if (playerIndex !== game.currentPlayerIndex) {
      socket.emit("invalidMove");

      return;
    }

    const player = game.players[playerIndex];

    // Check if the player has the card in their hand
    if (!player.hand.find((c) => c.uuid === card.uuid)) {
      socket.emit("invalidMove2");
      return;
    }

    // Check if the card can be played
    if (!checkmove(card, game.currentCard)) {
      console.log("Invalid move");
      socket.emit("invalidMove");
      return;
    }
    game.currentCard = card;
    console.log("Valid move");

    game.statistics.totalCardsPlayed += 1;
    if (specialCards.includes(card.value)) {
      game.statistics.specialCardsPlayed += 1;
    }

    let nextPlayerIndex =
      (game.currentPlayerIndex + game.direction + game.players.length) %
      game.players.length;

    game.players.forEach((playerSocket) => {
      playerSocket.emit("cardPlayed", card);
    });

    // Check for special cards like "draw4"
    if (card.value === "draw4") {
      let cards = [];
      for (let i = 0; i < 4; i++) {
        let card = generateCard("notstart");
        cards.push(card);

        game.players[nextPlayerIndex].hand.push(card);
      }

      game.players[nextPlayerIndex].emit("drawCards", cards);
      for (let i = 0; i < 4; i++) {}
      game.currentPlayerIndex = nextPlayerIndex;
    }

    if (card.value === "draw2") {
      if (game.players[nextPlayerIndex].hand.find((c) => c.value === "draw2")) {
        game.cardstodraw += 2;
      } else {
        game.cardstodraw += 2;
        let cards = [];
        // draw as many cards as needed
        for (let i = 0; i < game.cardstodraw; i++) {
          let card = generateCard("notstart");
          cards.push(card);
          game.players[nextPlayerIndex].hand.push(card);
        }

        game.players[nextPlayerIndex].emit("drawCards", cards);

        game.cardstodraw = 0;
      }
    }

    if (card.value !== "draw2") {
      if (game.cardstodraw > 0) {
        // Draw cards
        let cards = [];
        for (let i = 0; i < game.cardstodraw; i++) {
          let card = generateCard("notstart");
          cards.push(card);
          player.hand.push(card);
          console.log("card drawn");
        }

        game.players[playerIndex].emit("drawCards", cards);

        game.cardstodraw = 0;
      }
    }

    // Optionally, you can skip the next player's turn after drawing cards

    player.hand = player.hand.filter((c) => c.uuid !== card.uuid);
    updateTurn(game, card);

    checkForWinner(game, player);
  });

  socket.on("resetGame", () => {
    //find the game id from players
    gameId = socket.currentGameId;

    // call resetGame function
    if (!games[gameId]) {
      // Back to the lobby
      console.log("Game not found");
      return;
    }

    startGame(gameId, "start");
  });

  // When a card is drawn, the server sends a new card to the player and notifies the opponent
  socket.on("drawCard", () => {
    const currentGameId = socket.currentGameId; // Retrieve the currentGameId from the socket
    if (!currentGameId || !games[currentGameId]) return;

    //check if the game is in progress
    if (!games[currentGameId].currentCard) {
      return;
    }

    const game = games[currentGameId];

    const playerIndex = game.players.findIndex((s) => s === socket);

    if (playerIndex !== game.currentPlayerIndex) {
      socket.emit("error", "Not your turn");
      return;
    }

    const player = game.players[playerIndex];

    if (game.cardstodraw > 0) {
      let cards = [];
      for (let i = 0; i < game.cardstodraw; i++) {
        let card = generateCard("notstart");
        cards.push(card);
        player.hand.push(card);
      }

      socket.emit("drawCards", cards);
      game.cardstodraw = 0;
      updateTurn(game);
    } else {
      const card = generateCard("notstart");
      player.hand.push(card);
      socket.emit("drawCard", card);

      updateTurn(game);
    }
  });

  socket.on("requestGames", () => {
    refreshGamesList();
  });

  function updateTurn(game, card) {
    console.log("Updating turn");
    emitPlayerHandSizes(game);

    // Handle special cases for two players
    if (game.players.length === 2) {
      if (card) {
        if (card.value === "skip" || card.value === "reverse") {
          // In a two-player game, "skip" and "reverse" don't change the currentPlayerIndex.
          console.log(
            "Skip or reverse in a 2-player game, turn remains with",
            game.currentPlayerIndex
          );
          game.players[game.currentPlayerIndex].emit("yourTurn");
          return;
        }
      }
    } else {
      // Handle "skip" and "reverse" in games with more than two players
      if (card) {
        if (card.value === "skip") {
          game.currentPlayerIndex =
            (game.currentPlayerIndex +
              game.direction * 2 +
              game.players.length) %
            game.players.length;
          console.log(
            "Skip in a game with more than 2 players, next turn for",
            game.currentPlayerIndex
          );
          game.players[game.currentPlayerIndex].emit("yourTurn");

          game.players.forEach((playerSocket) => {
            playerSocket.emit(
              "gameinfo",
              game.direction,
              game.players[game.currentPlayerIndex].id
            );
          });
          return;
        }

        if (card.value === "reverse") {
          game.direction *= -1;
          if (game.players.length > 1) {
            game.currentPlayerIndex =
              (game.currentPlayerIndex + game.direction + game.players.length) %
              game.players.length;
          }
          console.log(
            "Reverse in a game with more than 2 players, next turn for",
            game.currentPlayerIndex
          );
          game.players[game.currentPlayerIndex].emit("yourTurn");

          game.players.forEach((playerSocket) => {
            playerSocket.emit(
              "gameinfo",
              game.direction,
              game.players[game.currentPlayerIndex].id
            );
          });
          return;
        }
      }
    }

    // General case for updating the currentPlayerIndex
    game.currentPlayerIndex =
      (game.currentPlayerIndex + game.direction + game.players.length) %
      game.players.length;
    console.log("General turn update, next turn for", game.currentPlayerIndex);
    game.players[game.currentPlayerIndex].emit("yourTurn");
    game.players.forEach((playerSocket) => {
      playerSocket.emit(
        "gameinfo",
        game.direction,
        game.players[game.currentPlayerIndex].id
      );
    });
  }
});

function resetGame(game) {
  // Clear players' hands
  game.players.forEach((playerSocket) => {
    playerSocket.emit("clearHands");
    // Resetting each player's hand and handSize within the game context
    const playerIndex = game.players.findIndex((s) => s === playerSocket);
    if (playerIndex !== -1) {
      game.players[playerIndex].hand = [];
    }
  });
}

function emitPlayerHandSizes(game) {
  // Create an object to hold the hand sizes for each player
  let handSizes = {};

  // Iterate over each player to calculate hand sizes
  game.players.forEach((player) => {
    //also add the usernames to the handSizes object
    handSizes[player.id] = {
      handSize: player.hand.length,
      username: player.username,
    };
  });

  // Now emit the hand sizes to each player
  game.players.forEach((player) => {
    player.emit("playerHandSizes", handSizes);
  });
}

function emitusernamelist(gameId) {
  let usernames = [];
  games[gameId].players.forEach((player) => {
    //if username is null, write "waiting for username"
    if (!player.username) {
      usernames.push("Waiting for username");
    } else {
      usernames.push(player.username);
    }
  });

  games[gameId].players.forEach((player) => {
    player.emit("users", usernames);
  });
}

function startGame(gameId, overwritestart) {
  const game = games[gameId];

  let everyonehasusername = true;
  game.players.forEach((player) => {
    if (!player.username) {
      console.log("Not all players have a username");
      everyonehasusername = false;
    }
  });

  if (!everyonehasusername) {
    emitusernamelist(gameId);
    return;
  }

  if (game.players.length < 3) {
    if (overwritestart !== "start") {
      return;
    }
  }

  // log all players

  // reset the game statistics
  let oldwins = game.statistics.wins;

  game.statistics = {
    totalCardsPlayed: 0,
    specialCardsPlayed: 0,
    wins: oldwins,
    time: new Date().getTime(),
  };

  game.direction = 1;

  for (let i = 0; i < game.players.length; i++) {}
  resetGame(game);
  console.log("Game started for game ID:", gameId);

  // Deal cards and set hand sizes
  game.players.forEach((playerSocket, index) => {
    const hand = [];

    for (let i = 0; i < 7; i++) {
      hand.push(generateCard("notstart"));
    }

    // Store the hand in the player object
    const playerIndex = game.players.findIndex((s) => s === playerSocket);
    game.players[playerIndex].hand = hand;

    playerSocket.emit("dealCards", hand);
  });

  // Draw the first card from the deck and emit a 'cardPlayed' event
  game.currentCard = generateCard("start");

  refreshGamesList();

  // Notify each player about the current card
  game.players.forEach((playerSocket) => {
    playerSocket.emit("cardPlayed", game.currentCard);
  });

  game.players.forEach((playerSocket) => {
    playerSocket.emit(
      "gameinfo",
      game.direction,
      game.players[game.currentPlayerIndex].id
    );
  });

  // Randomly select who starts the game
  game.currentPlayerIndex = Math.floor(Math.random() * game.players.length);
  game.players[game.currentPlayerIndex].emit("yourTurn");

  emitPlayerHandSizes(game);
}

const colors = ["red", "green", "blue", "yellow"];
const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const specialCards = ["skip", "reverse", "draw2", "wild", "draw4"];

function generateCard(start) {
  const allCards = [...values, ...specialCards];
  const randomCard = allCards[Math.floor(Math.random() * allCards.length)];

  let cardColor = "white"; // Default color for wild and draw4

  if (start === "start") {
    cardColor = colors[Math.floor(Math.random() * colors.length)];
  }

  // Assign a color if the card is not wild or draw4
  if (!["wild", "draw4"].includes(randomCard)) {
    cardColor = colors[Math.floor(Math.random() * colors.length)];
  }

  // Generate a UUID for the card
  const uuid = uuidv4();

  // Return the card with its color, value, and UUID
  return { color: cardColor, value: randomCard, uuid: uuid };
}

function checkmove(card, currentCard) {
  if (card.value === "wild" || card.value === "draw4") {
    if (card.color === "white") {
      return false;
    }
    return true;
  }

  if (
    card.value === "skip" ||
    card.value === "reverse" ||
    card.value === "draw2"
  ) {
    if (card.color === currentCard.color || card.value === currentCard.value) {
      return true;
    }
    return false;
  }

  return card.color === currentCard.color || card.value === currentCard.value;
}

function checkForWinner(game, playerSocket) {
  const playerIndex = game.players.findIndex((s) => s === playerSocket);
  const player = game.players[playerIndex];

  if (player.hand.length === 0) {
    game.statistics.wins.push(player.id);

    game.statistics.time = new Date().getTime() - game.statistics.time;

    // Convert time to minutes:seconds
    let minutes = Math.floor(game.statistics.time / 60000);
    let seconds = Math.floor((game.statistics.time % 60000) / 1000);

    // Ensure two-digit formatting for minutes and seconds
    minutes = minutes.toString().padStart(2, "0");
    seconds = seconds.toString().padStart(2, "0");

    game.statistics.time = `${minutes}:${seconds}`;

    console.log(game.statistics.time);

    playerSocket.emit("gameEnd", {
      result: "win",
      statistics: game.statistics,
    });

    //add winner to statistics

    // Find and notify the loser(s) and send them the statistics
    game.players.forEach((p, idx) => {
      if (idx !== playerIndex) {
        p.emit("gameEnd", { result: "lose", statistics: game.statistics });
      }
    });

    // Optionally, you might want to reset or clear the statistics after the game ends
  }
}

function generategameId() {
  return Math.random().toString(36).substr(2, 5);
}

function refreshGamesList() {
  const gamesInfo = Object.keys(games).map((gameId) => ({
    gameId,
    playersCount: games[gameId].players.length, // Make sure this is correctly accessing the players array
    isFull: games[gameId].players.length >= 4,
  }));
  io.emit("gamesList", gamesInfo);
}

const port = 3000;
server.listen(port, () => console.log(`Listening on port ${port}`));
