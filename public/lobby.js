const socket = io();

document.getElementById("createGame").addEventListener("click", () => {
  socket.emit("createGame");
});

document.getElementById("joinGame").addEventListener("click", () => {
  const gameId = document.getElementById("gameId").value;
  if (gameId) {
    socket.emit("joinGame", gameId);
  } else {
    alert("Please enter a game ID.");
  }
});

socket.on("gameCreated", (gameId) => {
  console.log(`Game created with ID: ${gameId}`);
  // Redirect to game page
  window.location.href = `/game/${gameId}`;
});

socket.on("joinedGame", (gameId) => {
  console.log(`Joined game with ID: ${gameId}`);
  // Redirect to game page
  window.location.href = `/game/${gameId}`;
});

socket.on("error", (message) => {
  alert(`Error: ${message}`);
});
