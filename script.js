let current = 0;
function nextScreen() {
  let screens = document.querySelectorAll(".screen");
  if (current < screens.length - 1) {
    screens[current].classList.remove("active");
    current++;
    screens[current].classList.add("active");
  }
}
function confetti() {
  document.getElementById("confetti").classList.remove("hidden");
}
