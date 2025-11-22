// 1. Parallax Effect (Updated to keep text centered)
const bgText = document.getElementById("bgText");

document.addEventListener("mousemove", (e) => {
    // Calculate movement relative to center
    const x = (e.clientX / window.innerWidth - 0.5) * 40; // Increased movement range slightly
    const y = (e.clientY / window.innerHeight - 0.5) * 40;

    // Important: We keep the -50% translation to keep it centered, 
    // and ADD the mouse movement in pixels.
    bgText.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
});

// 2. Number Counter Animation
const counterElement = document.getElementById("userCount");

function animateCounter(element) {
    const target = +element.getAttribute('data-target'); // Get 12457
    const duration = 2000; // Animation time in ms (2 seconds)
    const increment = target / (duration / 16); // 60fps calculation

    let current = 0;

    const updateCount = () => {
        current += increment;

        if (current < target) {
            // Format with commas (e.g., 1,200) and no decimals
            element.innerText = Math.ceil(current).toLocaleString();
            requestAnimationFrame(updateCount);
        } else {
            // Ensure final number is exact
            element.innerText = target.toLocaleString();
        }
    };

    updateCount();
}

// Start animation when page loads
window.addEventListener('load', () => {
    animateCounter(counterElement);
});
