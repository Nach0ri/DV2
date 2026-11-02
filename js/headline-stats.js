// Headline figures in the page header.
// The final values are already in the HTML (so the page reads correctly without JavaScript).
// This script counts each number up from zero when the header comes into view, replays the count
// on hover or keyboard focus, and skips all motion for readers who prefer reduced motion.
(function () {
    const tiles = [...document.querySelectorAll(".hl-stat")];
    if (tiles.length === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DURATION = 1200; // ms
    const ease = t => 1 - Math.pow(1 - t, 3); // ease-out cubic

    function format(value, decimals, suffix) {
        return value.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    }

    function run(tile, delay = 0) {
        const num = tile.querySelector(".hl-num");
        const target = Number(num.dataset.value);
        const decimals = Number(num.dataset.decimals || 0);
        const suffix = num.dataset.suffix || "";
        const finalText = format(target, decimals, suffix);
        if (reduceMotion || !Number.isFinite(target)) { num.textContent = finalText; tile.classList.add("is-done"); return; }

        const finish = () => {
            cancelAnimationFrame(tile._raf);
            clearTimeout(tile._safety);
            num.textContent = finalText;
            tile.classList.remove("is-counting");
            tile.classList.add("is-done");
        };

        cancelAnimationFrame(tile._raf);
        clearTimeout(tile._timer);
        clearTimeout(tile._safety);
        tile.classList.remove("is-done");
        tile.classList.add("is-counting");
        // Restart the bar animation from empty.
        tile.classList.remove("is-animating");
        void tile.offsetWidth;
        tile._timer = setTimeout(() => {
            tile.classList.add("is-animating");
            const start = performance.now();
            const step = now => {
                const t = Math.min(1, (now - start) / DURATION);
                num.textContent = format(target * ease(t), decimals, suffix);
                if (t < 1) tile._raf = requestAnimationFrame(step);
                else finish();
            };
            tile._raf = requestAnimationFrame(step);
        }, delay);
        // Safety net: if animation frames are paused (background tab, print, screenshot tools),
        // still land on the exact value rather than leaving a partial count on screen.
        tile._safety = setTimeout(finish, delay + DURATION + 250);
    }

    // Start from zero so the final values do not flash before the count begins.
    if (!reduceMotion) for (const tile of tiles) {
        const num = tile.querySelector(".hl-num");
        num.textContent = format(0, Number(num.dataset.decimals || 0), num.dataset.suffix || "");
    }

    // First run: staggered, once the header is visible.
    const container = tiles[0].parentElement;
    const startAll = () => tiles.forEach((tile, i) => run(tile, i * 150));
    if ("IntersectionObserver" in window && !reduceMotion) {
        const io = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) { startAll(); io.disconnect(); }
        }, { threshold: 0.3 });
        io.observe(container);
    } else {
        startAll();
    }

    // Replay on hover or keyboard focus (not while a count is already running).
    for (const tile of tiles) {
        const replay = () => { if (!tile.classList.contains("is-counting")) run(tile); };
        tile.addEventListener("mouseenter", replay);
        tile.addEventListener("focus", replay);
    }
})();
