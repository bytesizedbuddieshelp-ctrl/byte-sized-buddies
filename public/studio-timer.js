// A steady clock for the video studio's camera circle.
// Timers in a worker keep running while the studio tab is in the background (you are showing another window).
let id = null;
onmessage = (event) => {
  clearInterval(id);
  id = null;
  if (typeof event.data === 'number') id = setInterval(() => postMessage('tick'), event.data);
};
