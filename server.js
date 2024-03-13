const express = require("express");
const http = require("http");
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

  console.log("Requested game ID:", gameId);

  if (games[gameId]) {
    res.sendFile(__dirname + "/public/game.html");
  } else {
    res.redirect("/lobby");
  }
});

app.get("/lobby", (req, res) => {
  res.sendFile(__dirname + "/public/lobby.html");
});

io.on("connection", (socket) => {
  socket.on("createGame", () => {
    const gameId = uuidv4();
    games[gameId] = {
      players: [socket],
      currentPlayerIndex: 0,
      deck: [],
      currentCard: null,
      cardstodraw: 0,
    };
    socket.currentGameId = gameId; // Store gameId on the socket object
    socket.emit("gameCreated", gameId);
  });

  socket.on("joinGame", (gameId) => {
    if (games[gameId] && games[gameId].players.length < 2) {
      //check if player is already in the game
      for (let i = 0; i < games[gameId].players.length; i++) {
        if (games[gameId].players[i] === socket) {
          return;
        }
      }

      games[gameId].players.push(socket);
      socket.currentGameId = gameId; // Store gameId on the socket object
      socket.emit("joinedGame", gameId);
      console.log(`Player joined game with ID: ${gameId}`);
      if (games[gameId].players.length === 2) {
        startGame(gameId);
      }
    } else {
      socket.emit(
        "error",
        "Unable to join game: Invalid game ID or game is full."
      );
    }
  });

  socket.on("disconnect", () => {
    const gameId = socket.currentGameId;
    if (gameId && games[gameId]) {
      const game = games[gameId];
      const playerIndex = game.players.findIndex((s) => s === socket);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1); // Remove the disconnected player
        // Additional logic here to handle the game state when players disconnect
      }
    }
  });

  socket.on("playCard", (card) => {
    const currentGameId = socket.currentGameId; // Retrieve the currentGameId from the socket
    if (!currentGameId || !games[currentGameId]) return;
    const game = games[currentGameId];
    const playerIndex = game.players.findIndex((s) => s === socket);

    if (playerIndex !== game.currentPlayerIndex) {
      socket.emit("invalidMove", "Not your turn");
      return;
    }

    const player = game.players[playerIndex];

    // Check if the player has the card in their hand
    if (!player.hand.find((c) => c.uuid === card.uuid)) {
      socket.emit("invalidMove", card);
      return;
    }

    // Check if the card can be played
    if (!checkmove(card, game.currentCard)) {
      socket.emit("invalidMove", card);
      return;
    }

    console.log("Valid move");
    let nextPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.players[nextPlayerIndex].emit("opponentHandSize", -1);

    game.currentCard = card;
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
      for (let i = 0; i < 4; i++) {
        game.players[nextPlayerIndex].handSize++;
      }

      game.players[game.currentPlayerIndex].emit("opponentHandSize", 4);
      game.currentPlayerIndex = nextPlayerIndex;
    }

    if (card.value === "draw2") {
      if (game.players[nextPlayerIndex].hand.find((c) => c.value === "draw2")) {
        game.cardstodraw += 2;
        console.log("next has to draw " + game.cardstodraw + " cards");
      } else {
        let cards = [];
        for (let i = 0; i < 2; i++) {
          let card = generateCard("notstart");
          cards.push(card);
          game.players[nextPlayerIndex].hand.push(card);
        }

        game.players[nextPlayerIndex].emit("drawCards", cards);
        for (let i = 0; i < 2; i++) {
          game.players[nextPlayerIndex].handSize++;
        }

        game.players[game.currentPlayerIndex].emit("opponentHandSize", 2);
        game.currentPlayerIndex = nextPlayerIndex;
      }
    }

    // Optionally, you can skip the next player's turn after drawing cards
    updateTurn(game, card);

    player.handSize--;
    player.hand = player.hand.filter((c) => c.uuid !== card.uuid);
    console.log(player.hand);
    checkForWinner(game, player);
  });

  // When a card is drawn, the server sends a new card to the player and notifies the opponent
  socket.on("drawCard", () => {
    const currentGameId = socket.currentGameId; // Retrieve the currentGameId from the socket
    if (!currentGameId || !games[currentGameId]) return;
    const game = games[currentGameId];
    const playerIndex = game.players.findIndex((s) => s === socket);
    console.log("player drew a card");

    if (playerIndex !== game.currentPlayerIndex) {
      socket.emit("error", "Not your turn");
      return;
    }

    const player = game.players[playerIndex];

    if (game.cardstodraw > 0) {
      console.log(`player has to draw ${game.cardstodraw} cards`);
      let cards = [];
      for (let i = 0; i < game.cardstodraw; i++) {
        let card = generateCard("notstart");
        cards.push(card);
        player.hand.push(card);
      }

      socket.emit("drawCards", cards);
      player.handSize += game.cardstodraw;
      game.cardstodraw = 0;
      updateTurn(game);
    } else {
      player.handSize++;
      const card = generateCard("notstart");
      player.hand.push(card);
      socket.emit("drawCard", card);

      const opponentIndex = (game.currentPlayerIndex + 1) % game.players.length;
      game.players[opponentIndex].emit("opponentHandSize", 1);
      updateTurn(game);
    }
  });
});

function updateTurn(game, card) {
  if (card) {
    if (card.value === "skip") {
      game.currentPlayerIndex =
        (game.currentPlayerIndex + 2) % game.players.length;
      game.players[game.currentPlayerIndex].emit("yourTurn");
      return;
    }

    if (card.value === "reverse") {
      game.players.reverse();

      // Update currentPlayerIndex to reflect the new order
      game.currentPlayerIndex =
        game.players.length - game.currentPlayerIndex - 1;
    }
  }

  // Advance to the next player
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.players[game.currentPlayerIndex].emit("yourTurn");
}

function resetGame(game) {
  // Clear players' hands
  game.players.forEach((playerSocket) => {
    playerSocket.emit("clearHands");
    // Resetting each player's hand and handSize within the game context
    const playerIndex = game.players.findIndex((s) => s === playerSocket);
    if (playerIndex !== -1) {
      game.players[playerIndex].hand = [];
      game.players[playerIndex].handSize = 0;
    }
  });
}

function startGame(gameId) {
  const game = games[gameId];

  if (game.players.length < 2) {
    console.log(game.players);
    return;
  }

  // log all players

  for (let i = 0; i < game.players.length; i++) {
    console.log(game.players[i].id);
  }
  console.log("Starting game for game ID:", gameId);
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
    game.players[playerIndex].handSize = hand.length;

    playerSocket.emit("dealCards", hand);

    // Notify each player about their opponent's hand size
    let opponentIndex = (index + 1) % game.players.length;
    game.players[opponentIndex].emit("opponentHandSize", hand.length);
  });

  // Draw the first card from the deck and emit a 'cardPlayed' event
  game.currentCard = generateCard("start");

  // Notify each player about the current card
  game.players.forEach((playerSocket) => {
    playerSocket.emit("cardPlayed", game.currentCard);
  });

  // Randomly select who starts the game
  game.currentPlayerIndex = Math.floor(Math.random() * game.players.length);
  game.players[game.currentPlayerIndex].emit("yourTurn");
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

  if (player.handSize === 0) {
    // Player won
    playerSocket.emit("gameEnd", "win");

    // Find and notify the loser(s)
    game.players.forEach((p, idx) => {
      if (idx !== playerIndex) {
        p.emit("gameEnd", "lose");
      }
    });
  }
}

const port = 3000;
server.listen(port, () => console.log(`Listening on port ${port}`));
