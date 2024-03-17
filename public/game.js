var socket = io();

var isMyTurn = false;
let colorPickeractive = false;
let gameStarted = false;

socket.on("dealCards", function (hand) {
  gameStarted = true;
  // Hide Settings
  const settings = document.getElementById("gradient-border");
  settings.style.display = "none";

  const playerHand = document.getElementById("hand");
  playerHand.innerHTML = ""; // Clear existing cards
  hand.forEach((card, index) => {
    let cardElement = document.createElement("img");
    cardElement.classList.add("card");
    if (card.value === "wild" || card.value === "draw4") {
      cardElement.draggable = false;
    } else {
      cardElement.draggable = true;
    }
    cardElement.addEventListener("click", function () {
      if (card.value === "wild" || card.value === "draw4") {
        showColorPicker(card.uuid);
      } else {
        playCardid(card);
      }
    });
    cardElement.src = `/img/${card.color}_${card.value}.png`;
    cardElement.setAttribute("data-color", card.color);
    cardElement.setAttribute("data-value", card.value);
    cardElement.id = card.uuid;

    // Initial animation styles
    cardElement.style.opacity = "0";
    cardElement.style.transform = "scale(0.5)";
    cardElement.style.transition = "transform 0.5s, opacity 0.5s";
    cardElement.style.transitionDelay = `${index * 100}ms`; // Delay for card entry animation

    cardElement.addEventListener("dragstart", drag);
    playerHand.appendChild(cardElement);

    // Animate to full opacity and size
    setTimeout(() => {
      cardElement.style.opacity = "1";
      cardElement.style.transform = "scale(1)";
    }, 10 + index * 100); // Stagger the animations slightly for each card
  });

  // show socket id
  const socketId = document.getElementById("player-info");
  socketId.innerHTML = socket.id;
});

socket.on("playerHandSizes", function (handSizes) {
  console.log("Received hand sizes: ", handSizes);

  const mySocketId = socket.id;
  const sortedIds = Object.keys(handSizes).sort();
  const myIndex = sortedIds.indexOf(mySocketId);
  const sortedOpponentIds = [
    ...sortedIds.slice(myIndex + 1),
    ...sortedIds.slice(0, myIndex),
  ].filter((id) => id !== mySocketId);

  const totalPlayers = sortedIds.length;

  sortedOpponentIds.forEach((socketId, index) => {
    let size = handSizes[socketId].handSize;
    let opponentNumber;
    let positionClass;

    if (totalPlayers === 2) {
      opponentNumber = 1;
      positionClass = "top";
    } else if (totalPlayers === 3) {
      opponentNumber = index + 1;
      // The first opponent (opponent-1) should be on the top, the second (opponent-2) on the right
      positionClass = opponentNumber === 1 ? "top" : "right";
    } else if (totalPlayers === 4) {
      // For 4 players, we'll assign positions as: 3 - left, 1 - top, 2 - right
      opponentNumber = index + 1;
      positionClass =
        opponentNumber === 1 ? "left" : opponentNumber === 2 ? "top" : "right";
    }

    let opponentHandId = `opponent-${opponentNumber}-hand`;
    let opponentHandContainer =
      document.getElementById(opponentHandId) || document.createElement("div");
    opponentHandContainer.id = opponentHandId;
    opponentHandContainer.className = ""; // Reset classes
    opponentHandContainer.classList.add(
      "opponent-hand",
      `opponent-${opponentNumber}`,
      positionClass,
      `${socketId}`
    );

    // Clear the previous hand (if any)
    opponentHandContainer.innerHTML = "";

    // Create card placeholders
    for (let i = 0; i < size; i++) {
      let cardPlaceholder = document.createElement("img");
      cardPlaceholder.classList.add("opponent-card");
      // Add vertical class for specific conditions
      if (
        (totalPlayers === 3 && opponentNumber === 2) ||
        (totalPlayers === 4 && (opponentNumber === 1 || opponentNumber === 3))
      ) {
        cardPlaceholder.classList.add("vertical");
      }
      cardPlaceholder.src = "/img/white.png";
      opponentHandContainer.appendChild(cardPlaceholder);
    }

    // Append or update the opponent's hand container
    if (!document.getElementById(opponentHandId)) {
      document.getElementById("opponents").appendChild(opponentHandContainer);
    }

    // Add the username next to the hand
    let username = document.createElement("p");
    username.innerHTML = handSizes[socketId].username;
    username.classList.add("username");
    opponentHandContainer.appendChild(username);
  });

  // Add the own username
  let username = document.createElement("p");
  ownusername = handSizes[mySocketId].username;
  username.innerHTML = ownusername;
  username.classList.add("username");
  document.getElementById("ownusername").appendChild(username);
});

socket.on("clearHands", function () {
  document.getElementById("hand").innerHTML = "";
  document.getElementById("opponents").innerHTML = "";

  // hide winner message
  const resultDiv = document.querySelector(".result-overlay");
  if (resultDiv) {
    resultDiv.remove();
  }

  const gameArea = document.querySelectorAll("card-played");

  gameArea.forEach((element) => {
    element.remove();
  });

  const activeElements = document.querySelectorAll(".active");
  activeElements.forEach((element) => element.classList.remove("active"));

  const currentPlayerHandElement = document.getElementById(
    `opponent-${currentPlayerid}-hand`
  );
  if (currentPlayerHandElement) {
    currentPlayerHandElement.classList.add("active");
  }
});

socket.on("drawCard", function (card) {
  console.log("Card drawn: ", card);
  let cardElement = document.createElement("img");
  cardElement.classList.add("card");
  if (card.value === "wild" || card.value === "draw4") {
    cardElement.draggable = false;
  } else {
    cardElement.draggable = true;
  }
  cardElement.addEventListener("click", function () {
    if (card.value === "wild" || card.value === "draw4") {
      showColorPicker(card.uuid);
    } else {
      playCardid(card);
    }
  });
  cardElement.src = `/img/${card.color}_${card.value}.png`;
  cardElement.setAttribute("data-color", card.color);
  cardElement.setAttribute("data-value", card.value);
  cardElement.id = card.uuid;

  // Start with reduced size and opacity for the animation
  cardElement.style.opacity = "0";
  cardElement.style.transform = "scale(0.5)";
  cardElement.style.transition = "transform 0.5s, opacity 0.5s";

  cardElement.addEventListener("dragstart", drag);
  let playerHand = document.getElementById("hand");
  playerHand.appendChild(cardElement); // Append the new card to the hand

  // Animate the new card to its full size and opacity
  setTimeout(() => {
    cardElement.style.opacity = "1";
    cardElement.style.transform = "scale(1)";
  }, 10);
});

socket.on("drawCards", function (cards) {
  let playerHand = document.getElementById("hand");

  cards.forEach((card, index) => {
    let cardElement = document.createElement("img");
    cardElement.classList.add("card");
    if (card.value === "wild" || card.value === "draw4") {
      cardElement.draggable = false;
    } else {
      cardElement.draggable = true;
    }
    cardElement.addEventListener("click", function () {
      if (card.value === "Wild" || card.value === "Draw4") {
        showColorPicker(card.uuid);
        console.log("showColorPicker");
      } else {
        playCardid(card);
      }
    });
    cardElement.src = `/img/${card.color}_${card.value}.png`;
    cardElement.setAttribute("data-color", card.color);
    cardElement.setAttribute("data-value", card.value);
    cardElement.id = card.uuid;

    // Initial styles for animation
    cardElement.style.opacity = "0";
    cardElement.style.transform = "scale(0.5)";
    cardElement.style.transition = "transform 0.5s, opacity 0.5s";

    cardElement.addEventListener("dragstart", drag);
    playerHand.appendChild(cardElement); // Append the new card to the hand

    // Animate to full size and opacity after appending
    setTimeout(() => {
      cardElement.style.opacity = "1";
      cardElement.style.transform = "scale(1)";
    }, 10 + index * 100); // Stagger the animations slightly for each card
  });
});

socket.on("cardPlayed", function (card) {
  console.log("Card played: ", card);

  // remove color picker
  const colorPicker = document.getElementById("color-picker");
  colorPicker.style.display = "none";
  colorPicker.innerHTML = "";

  // remove card from hand
  const cardElements = document.getElementById(card.uuid);
  if (cardElements) {
    removeCard(card);
    colorPickeractive = false;
  } else {
    console.error("Could not find card with UUID:", card.uuid);
  }
  isMyTurn = false;
  var cardElement = document.createElement("img");
  cardElement.classList.add("card-played");
  cardElement.src = `/img/${card.color}_${card.value}.png`;
  const rotationOffset = Math.random() * 40 - 20; // consistent rotation range
  cardElement.style.setProperty("--rotation-offset", `${rotationOffset}deg`);
  document.getElementById("game-area").appendChild(cardElement);
});

socket.on("opponentDrewCard", function () {
  const opponentHand = document.getElementById("opponents");
  let cardPlaceholder = document.createElement("img");
  cardPlaceholder.classList.add("card");
  cardPlaceholder.src = "img/white.png";

  // Start with reduced opacity and size for animation
  cardPlaceholder.style.opacity = "0";
  cardPlaceholder.style.transform = "scale(0.5)";
  opponentHand.appendChild(cardPlaceholder);

  // Animate to full opacity and size
  setTimeout(() => {
    cardPlaceholder.style.opacity = "1";
    cardPlaceholder.style.transform = "scale(1)";
  }, 10);

  isMyTurn = true;
  document.getElementById("hand").classList.add("active");
});
socket.on("yourTurn", function () {
  isMyTurn = true;
  document.getElementById("hand").classList.add("active");
});

function drag(event) {
  event.dataTransfer.setData("text", event.target.id);
}

function allowDrop(event) {
  event.preventDefault();
}

function drop(event) {
  event.preventDefault();
  if (!isMyTurn) {
    return;
  }

  var data = event.dataTransfer.getData("text");

  playCardid(data);
}

socket.on("gameinfo", function (direction, currentPlayerid) {
  const activeElements = document.querySelectorAll(".active");

  activeElements.forEach((element) => {
    if (element.classList.contains("opponent-hand")) {
      element.classList.remove("active");
    }
  });

  //set the current player as active
  const currentPlayerHandElements =
    document.getElementsByClassName(currentPlayerid);
  for (let i = 0; i < currentPlayerHandElements.length; i++) {
    currentPlayerHandElements[i].classList.add("active");
  }

  console.log("direction", direction);
  if (direction === 1) {
    document.getElementById("directionArrow").classList.remove("directionccw");
    document.getElementById("directionArrow").classList.add("directioncw");
  } else {
    document.getElementById("directionArrow").classList.remove("directioncw");
    document.getElementById("directionArrow").classList.add("directionccw");
  }
});

socket.on("gameEnd", function (data) {
  console.log(
    "Game over! Result:",
    data.result,
    "Statistics:",
    data.statistics
  );

  // Create a modal or overlay div to show the result and statistics
  const resultDiv = document.createElement("div");
  resultDiv.classList.add("result-overlay");
  document.body.appendChild(resultDiv);

  // Display the game result
  const resultMessage = document.createElement("h1");
  if (data.result === "win") {
    resultMessage.textContent = "You win!";
  } else if (data.result === "lose") {
    resultMessage.textContent = "You lose!";
  }
  resultDiv.appendChild(resultMessage);

  // Display game statistics
  const statsDiv = document.createElement("div");
  statsDiv.classList.add("stats");

  const totalCardsPlayed = document.createElement("p");
  totalCardsPlayed.textContent = `Total cards played: ${data.statistics.totalCardsPlayed}`;
  statsDiv.appendChild(totalCardsPlayed);

  const winners = document.createElement("p");
  winners.textContent = `Winners ${data.statistics.wins}`;
  statsDiv.appendChild(winners);

  const time = document.createElement("p");
  time.textContent = `Time Played ${data.statistics.time}`;
  statsDiv.appendChild(time);

  const specialCardsPlayed = document.createElement("p");
  specialCardsPlayed.textContent = `Special cards played: ${data.statistics.specialCardsPlayed}`;
  statsDiv.appendChild(specialCardsPlayed);

  resultDiv.appendChild(statsDiv);

  // Optionally, add a button to reset the game or navigate elsewhere
  const resetButton = document.createElement("button");
  resetButton.textContent = "Play Again";
  resetButton.addEventListener("click", function () {
    socket.emit("resetGame");
  });
  resultDiv.appendChild(resetButton);

  // Optionally, add a button to navigate back to the main menu
  const mainMenuButton = document.createElement("button");
  mainMenuButton.textContent = "Main Menu";
  mainMenuButton.addEventListener("click", function () {
    window.location.href = "/";
  });
  resultDiv.appendChild(mainMenuButton);
});

socket.on("notfound", function () {
  console.log("Game not found");
  window.location.href = "/";
});

socket.on("users", function (users) {
  console.log("users", users);
  const userList = document.getElementById("users");
  userList.innerHTML = "";

  users.forEach((user) => {
    const userDiv = document.createElement("div");

    userDiv.classList.add("user");
    userDiv.textContent = user;
    if (user.ready) {
      userDiv.classList.add("ready");
    } else {
      userDiv.classList.add("notready");
    }
    userList.appendChild(userDiv);
  });
});

function drawCard() {
  if (isMyTurn) {
    // Only allow drawing a card when it's the player's turn
    isMyTurn = false;
    socket.emit("drawCard");

    document.getElementById("hand").classList.remove("active");
  }
}

document.addEventListener("mouseover", function (event) {
  // Ensure we're working with an element
  if (event.target.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  // Use closest to find the nearest ancestor (or self) with the .card class
  const hoveredCard = event.target.closest(".card");

  // Proceed only if hoveredCard is not null
  if (hoveredCard) {
    const playerHand = document.getElementById("hand");
    const cards = Array.from(playerHand.children);
    const hoveredIndex = cards.indexOf(hoveredCard);

    hoveredCard.style.transform = "scale(2) !important";

    // Scale the adjacent cards
    if (hoveredIndex > 0) {
      // Scale the previous card slightly if it exists
      cards[hoveredIndex - 1].style.transform = "scale(1.1)";
      cards[hoveredIndex - 1].style.transform = "translateY(-8px)";
    }
    if (hoveredIndex < cards.length - 1) {
      // Scale the next card slightly if it exists
      cards[hoveredIndex + 1].style.transform = "scale(1.1)";
      cards[hoveredIndex + 1].style.transform = "translateY(-8px)";
    }
  }
});

document.addEventListener("mouseout", function (event) {
  if (event.target.classList.contains("card")) {
    const playerHand = document.getElementById("hand");
    Array.from(playerHand.children).forEach((card) => {
      // Reset the scale for all cards
      card.style.transform = "scale(1)";
    });
  }
});

function playCard(cardId) {
  if (!isMyTurn) {
    return;
  }

  var card = document.getElementById(cardId);
  if (!card) {
    console.error("Card element not found:", cardId);
    return;
  }

  isMyTurn = false;
  document.getElementById("hand").classList.remove("active");

  socket.emit("playCard", {
    color: card.getAttribute("data-color"),
    value: card.getAttribute("data-value"),
    uuid: card.id,
  });
}

function playCardid(data) {
  if (!isMyTurn) {
    return;
  }

  if (data.color === "white") {
    toggleColorPicker(data.uuid);
    return;
  }

  isMyTurn = false;
  document.getElementById("hand").classList.remove("active");
  if (!data) {
    console.error("No data retrieved on drop");
    return;
  }

  if (data.uuid) {
    var card = document.getElementById(data.uuid);
  } else {
    var card = document.getElementById(data);
  }

  if (!card) {
    console.error("Card element not found:", data);
    return;
  }

  console.log("color", card.getAttribute("data-color"));
  console.log("value", card.getAttribute("data-value"));
  console.log("uuid", card.id);

  socket.emit("playCard", {
    color: card.getAttribute("data-color"),
    value: card.getAttribute("data-value"),
    uuid: card.id,
  });
}

socket.on("invalidMove", function () {
  isMyTurn = true;
  document.getElementById("hand").classList.add("active");
  console.log("invalid Move!");
});

function selectColorfromspecial(cardId, cardType, color) {
  if (!isMyTurn) {
    return;
  }
  console.log("Selected color:", color);
  console.log("Selected card:", cardType);
  console.log("Selected cardId:", cardId);
  isMyTurn = false;
  document.getElementById("hand").classList.remove("active");

  socket.emit("playCard", {
    color: color,
    value: cardType,
    uuid: cardId,
  });
}

function toggleColorPicker(cardId) {
  if (!isMyTurn) {
    return;
  }

  let colorPicker = document.getElementById("color-picker");
  if (colorPickeractive) {
    colorPicker.style.display = "none";
    colorPickeractive = false;
  } else {
    colorPickeractive = true;
    let colorPicker = document.getElementById("color-picker");
    colorPicker.innerHTML = ""; // Clear previous options
    colorPicker.style.display = "flex";
    colorPicker.style.position = "absolute";
    colorPicker.style.flexDirection = "row";
    colorPicker.style.justifyContent = "center";
    colorPicker.style.transition = "transform 0.5s, opacity 0.5s";

    const rotations = [-30, -10, 10, 30]; // Rotation values for each card
    const colors = ["red", "yellow", "green", "blue"];
    const cardType = document.getElementById(cardId).getAttribute("data-value");
    colors.forEach((color, index) => {
      const colorOption = document.createElement("img");
      colorOption.classList.add("card");
      colorOption.classList.add("picker-card");
      colorOption.setAttribute("data-color", color);
      colorOption.setAttribute("data-value", cardType);
      draggable = false;

      colorOption.addEventListener("click", function () {
        selectColorfromspecial(cardId, cardType, color);
      });

      colorOption.src = `/img/${color}_${cardType}.png`;
      colorOption.style.transition = "transform 0.5s, opacity 0.5s";
      colorOption.style.opacity = "0";
      colorPicker.appendChild(colorOption);

      // Animate the options outwards and apply rotation
      setTimeout(() => {
        colorOption.style.transform = `rotate(${rotations[index]}deg) translateY(0)`;
        colorOption.style.opacity = "1";
      }, index * 100); // Stagger the animations for each card
    });

    document.body.appendChild(colorPicker);

    const cardElement = document.getElementById(cardId);
    const rect = cardElement.getBoundingClientRect();
    colorPicker.style.left = `${
      rect.left + rect.width / 2 - colorPicker.offsetWidth / 2
    }px`;
    colorPicker.style.top = `${rect.bottom + 10}px`; // Position below the card

    // Animate the color picker to move up into view
    setTimeout(() => {
      colorPicker.style.transform = "translateY(-160%)";
    }, 100);
  }
}

function showColorPicker(cardId) {
  toggleColorPicker(cardId);
}

function startgame() {
  if (gameStarted) {
    return;
  }
  const username = document.getElementById("username").value;

  let gameId = window.location.pathname.split("/").pop();
  socket.emit("startGame", gameId, username);
}

function removeCard(card) {
  const cardElement = document.getElementById(card.uuid);

  if (cardElement) {
    console.log("Starting removal:", card);
    // Start removal animation
    cardElement.style.opacity = "0";
    cardElement.style.width = "0px"; // Animate width to 0
    cardElement.style.margin = "0 5px"; // Remove margin during animation
    cardElement.style.transform = "translateY(20px)";

    // Immediately start adjusting the positions of the other cards

    cardElement.addEventListener("transitionend", function () {
      this.remove();
    });
  } else {
    console.error("Could not find card with UUID:", card.uuid);
  }
}

document.getElementById("draw-pile").addEventListener("mouseover", function () {
  let cards = Array.from(document.querySelectorAll(".drawCard")).filter(
    (card) => !card.src.includes("white.png")
  );

  //shuffle the cards
  cards = cards.sort(() => Math.random() - 0.5);

  if (cards.length >= 4) {
    // Move one card up and to the left
    cards[0].style.transform = `translateY(-20px) translateX(-20px) rotate(${
      Math.random() * 40 - 20
    }deg)`;
    // Move one card up and to the right
    cards[1].style.transform = `translateY(-20px) translateX(20px) rotate(${
      Math.random() * 40 - 20
    }deg)`;
    // Move one card down and to the left
    cards[2].style.transform = `translateY(20px) translateX(-20px) rotate(${
      Math.random() * 40 - 20
    }deg)`;
    // Move one card down and to the right
    cards[3].style.transform = `translateY(20px) translateX(20px) rotate(${
      Math.random() * 40 - 20
    }deg)`;
  }

  this.style.transform = `translateY(0px)`;
});

document.getElementById("draw-pile").addEventListener("mouseout", function () {
  const cards = document.querySelectorAll(".drawCard");
  cards.forEach((card) => {
    if (!card.src.includes("white.png")) {
      card.style.transform = "translateY(0px) translateX(0px)";
    }
  });
  this.style.transform = "translateY(0px)";
});

// find game id
const path = window.location.pathname;
const gameId = path.split("/").pop();

socket.emit("joinGame", gameId);

function selectOption(option) {
  var selection = document.getElementById("selection");
  var pickerWidth = document.querySelector(".picker").offsetWidth;
  var optionWidth = pickerWidth / 3; // since there are 3 options
  // Calculate the left position based on the option index and width
  var newLeft = (option - 1) * optionWidth;
  selection.style.left = newLeft + "px";
}
