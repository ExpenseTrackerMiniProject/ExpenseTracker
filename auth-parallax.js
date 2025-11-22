const bgText = document.getElementById("bgText");

document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 30;
    const y = (e.clientY / window.innerHeight - 0.5) * 30;

    bgText.style.transform = `translate(${x}px, ${y}px)`;
});
