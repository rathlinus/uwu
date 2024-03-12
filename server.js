const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

let deck = [];
let currentCard = null;

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});

let players = [];
let currentPlayerIndex = 0;
let cardstodraw = 0;

io.on("connection", (socket) => {
  console.log("player connected");
  players.push(socket);

  if (players.length === 2) {
    startGame();
  }

  socket.on("disconnect", () => {
    players = players.filter((player) => player !== socket);
    // Adjust currentPlayerIndex if necessary
    if (players.length > 0 && currentPlayerIndex >= players.length) {
      currentPlayerIndex = 0; // Reset to the first player if the current player disconnects
    }
  });

  socket.on("playCard", (card) => {
    if (socket === players[currentPlayerIndex]) {
      // Check if the player has the card in their hand

      if (!socket.hand.find((c) => c.uuid === card.uuid)) {
        players[currentPlayerIndex].emit("invalidMove", card);
        return;
      }
      // Check if the card can be played
      if (!checkmove(card, currentCard)) {
        players[currentPlayerIndex].emit("invalidMove", card);
        return;
      }

      console.log("Valid move");

      players[(currentPlayerIndex + 1) % players.length].emit(
        "opponentHandSize",
        -1
      );

      currentCard = card;
      io.emit("cardPlayed", card);

      // Check for special cards like "draw4"
      if (card.value === "draw4") {
        let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;

        let cards = [];
        for (let i = 0; i < 4; i++) {
          let card = generateCard("notstart");

          cards.push(card);

          players[nextPlayerIndex].hand.push(card);
        }

        players[nextPlayerIndex].emit("drawCards", cards);

        players[nextPlayerIndex].handSize++;
        players[nextPlayerIndex].handSize++;
        players[nextPlayerIndex].handSize++;
        players[nextPlayerIndex].handSize++;

        players[currentPlayerIndex].emit("opponentHandSize", 4);

        currentPlayerIndex = (nextPlayerIndex + 1) % players.length;
      }

      if (card.value === "draw2") {
        let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;

        //check if the next player has a draw2 card

        if (players[nextPlayerIndex].hand.find((c) => c.value === "draw2")) {
          cardstodraw += 2;
          console.log("next has to draw " + cardstodraw + " cards");
          console.log(players[nextPlayerIndex].hand);
        } else {
          let cards = [];
          for (let i = 0; i < 2; i++) {
            let card = generateCard("notstart");

            cards.push(card);

            players[nextPlayerIndex].hand.push(card);
            console.log(players[nextPlayerIndex].hand);
          }

          players[nextPlayerIndex].emit("drawCards", cards);

          // new hand size

          players[nextPlayerIndex].handSize++;
          players[nextPlayerIndex].handSize++;

          players[currentPlayerIndex].emit("opponentHandSize", 2);

          currentPlayerIndex = (nextPlayerIndex + 1) % players.length;
        }
      }

      // Optionally, you can skip the next player's turn after drawing cards
      updateTurn(card);
    }

    socket.handSize--;

    //remove the card from the player's hand
    socket.hand = socket.hand.filter((c) => c.uuid !== card.uuid);

    console.log(socket.hand);
    checkForWinner(socket);
  });

  // When a card is drawn, the server sends a new card to the player and notifies the opponent
  socket.on("drawCard", () => {
    console.log("player drew a card");
    if (socket === players[currentPlayerIndex]) {
      if (cardstodraw > 0) {
        console.log("player has to draw " + cardstodraw + " cards");
        let cards = [];
        for (let i = 0; i < cardstodraw; i++) {
          let card = generateCard("notstart");

          cards.push(card);

          socket.hand.push(card);
        }

        socket.emit("drawCards", cards);

        socket.handSize += cardstodraw;

        cardstodraw = 0;
        updateTurn();
        return;
      }
      socket.handSize++;
      const card = generateCard("notstart");
      socket.emit("drawCard", card);

      const opponentIndex = (currentPlayerIndex + 1) % players.length;
      players[opponentIndex].emit("opponentHandSize", 1);
      updateTurn();
    }
  });
});

function updateTurn(card) {
  if (card) {
    if (card.value === "skip") {
      currentPlayerIndex = (currentPlayerIndex + 2) % players.length;
      players[currentPlayerIndex].emit("yourTurn");
      return;
    }

    if (card && card.value === "reverse") {
      players.reverse();
    }
  }
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  players[currentPlayerIndex].emit("yourTurn");
}

function resetGame() {
  // Clear players' hands
  players.forEach((player) => {
    player.emit("clearHands");
  });
}

function startGame() {
  resetGame();
  console.log("Game started");
  // Deal cards and set hand sizes
  players.forEach((player, index) => {
    const hand = [];

    for (let i = 0; i < 7; i++) {
      hand.push(generateCard("notstart"));
    }

    // Store the hand in the player object
    player.hand = hand;

    player.emit("dealCards", hand);
    player.handSize = hand.length;

    // Notify each player about their opponent's hand size
    let opponentIndex = (index + 1) % players.length;
    players[opponentIndex].emit("opponentHandSize", hand.length);
  });

  io.emit("updateDeck", deck.length);

  // Draw the first card from the deck and emit a 'cardPlayed' event
  currentCard = generateCard("start");
  io.emit("cardPlayed", currentCard);
  io.emit("updateDeck", deck.length);
  currentPlayerIndex = Math.floor(Math.random() * players.length);
  players[currentPlayerIndex].emit("yourTurn");
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

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; // swap
  }
  return deck;
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

function checkForWinner(player) {
  if (player.handSize === 0) {
    // Player won
    player.emit("gameEnd", "win");

    // Find and notify the loser
    let loser = players.find((p) => p !== player);
    if (loser) {
      loser.emit("gameEnd", "lose");
    }
  }
}
