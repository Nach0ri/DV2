// Interactive wildlife background for the page header.
// Eucalyptus leaves drift across the header and a few birds fly through. Moving the pointer pushes nearby
// leaves aside and makes birds swerve; clicking sends a gust through the leaves.
// Purely decorative: the canvas is aria-hidden, sits behind the text, pauses when off-screen or in a
// background tab, and draws a single still frame for readers who prefer reduced motion.
(function () {
    const canvas = document.querySelector(".hero-bg");
    if (!canvas || !canvas.getContext) return;
    const header = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Project palette: eucalyptus, forest teal, river blue and ochre, kept faint so text stays readable.
    const LEAF_COLOURS = ["#6F9A86", "#176B60", "#8FB3A1", "#A8B98F"];   // greens and sage only: no category hues in decoration
    const BIRD_COLOUR = "#24493A";
    const REPEL = 110;           // pointer influence radius (px)

    let W = 0, H = 0, dpr = 1;
    let leaves = [], birds = [];
    const pointer = { x: -9999, y: -9999, active: false };
    let gust = 0;                // decays after a click
    let running = false, raf = 0, last = 0;

    const rand = (a, b) => a + Math.random() * (b - a);

    function resize() {
        const r = header.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(1, Math.round(r.width));
        H = Math.max(1, Math.round(r.height));
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const target = Math.round(Math.min(40, Math.max(14, W / 28)));
        while (leaves.length < target) leaves.push(makeLeaf(true));
        leaves.length = target;
        if (birds.length === 0) birds = [makeBird(true), makeBird(true), makeBird(true)];
        if (reduceMotion) draw();
    }

    function makeLeaf(anywhere) {
        return {
            x: anywhere ? rand(0, W) : rand(-40, -10),
            y: rand(0, H),
            len: rand(22, 40),
            rot: rand(0, Math.PI * 2),
            spin: rand(-0.012, 0.012),
            vx: rand(0.15, 0.45),
            vy: rand(-0.08, 0.12),
            sway: rand(0, Math.PI * 2),
            colour: LEAF_COLOURS[Math.floor(Math.random() * LEAF_COLOURS.length)],
            alpha: rand(0.3, 0.55),
            ox: 0, oy: 0             // offset from the pointer push, eased back to 0
        };
    }

    function makeBird(anywhere) {
        return {
            x: anywhere ? rand(W * 0.3, W) : rand(-80, -30),
            y: rand(H * 0.08, H * 0.45),
            vx: rand(0.55, 0.95),
            size: rand(10, 16),
            phase: rand(0, Math.PI * 2),
            flap: rand(0.12, 0.18),
            dy: 0
        };
    }

    // A eucalyptus leaf: long, narrow and slightly curved, with a midrib.
    function drawLeaf(l) {
        ctx.save();
        ctx.translate(l.x + l.ox, l.y + l.oy);
        ctx.rotate(l.rot);
        ctx.globalAlpha = l.alpha;
        ctx.fillStyle = l.colour;
        const L = l.len, w = L * 0.22;
        ctx.beginPath();
        ctx.moveTo(-L / 2, 0);
        ctx.bezierCurveTo(-L / 4, -w, L / 4, -w * 0.9, L / 2, 0);
        ctx.bezierCurveTo(L / 4, w * 0.7, -L / 4, w, -L / 2, 0);
        ctx.fill();
        ctx.globalAlpha = l.alpha * 0.9;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-L / 2 + 2, 0);
        ctx.quadraticCurveTo(0, -w * 0.15, L / 2 - 2, 0);
        ctx.stroke();
        ctx.restore();
    }

    // A bird in flight: two curved wing strokes that flap.
    function drawBird(b) {
        const s = b.size, f = Math.sin(b.phase) * s * 0.55;
        ctx.save();
        ctx.translate(b.x, b.y + b.dy);
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = BIRD_COLOUR;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-s, -f);
        ctx.quadraticCurveTo(-s * 0.45, -s * 0.15 - f * 0.4, 0, 0);
        ctx.quadraticCurveTo(s * 0.45, -s * 0.15 - f * 0.4, s, -f);
        ctx.stroke();
        ctx.restore();
    }

    function step(dt) {
        const k = dt / 16.7; // normalise to ~60 fps
        gust *= Math.pow(0.96, k);
        for (const l of leaves) {
            l.sway += 0.02 * k;
            l.x += (l.vx + gust) * k;
            l.y += (l.vy + Math.sin(l.sway) * 0.18) * k;
            l.rot += (l.spin + gust * 0.01) * k;
            // Pointer: push leaves out of a circle around the cursor, then let them ease back.
            if (pointer.active) {
                const dx = l.x + l.ox - pointer.x, dy = l.y + l.oy - pointer.y;
                const d = Math.hypot(dx, dy);
                if (d < REPEL && d > 0.1) {
                    const push = (1 - d / REPEL) * 3.2 * k;
                    l.ox += (dx / d) * push;
                    l.oy += (dy / d) * push;
                }
            }
            l.ox *= Math.pow(0.94, k);
            l.oy *= Math.pow(0.94, k);
            if (l.x - l.len > W + 20) Object.assign(l, makeLeaf(false));
            if (l.y < -30) l.y = H + 20;
            if (l.y > H + 30) l.y = -20;
        }
        for (const b of birds) {
            b.x += (b.vx + gust * 0.5) * k;
            b.phase += b.flap * 2 * k;
            // Pointer: birds swerve up or down away from the cursor.
            if (pointer.active) {
                const dx = b.x - pointer.x, dy = b.y + b.dy - pointer.y;
                if (Math.abs(dx) < 90 && Math.abs(dy) < 70) b.dy += (dy >= 0 ? 1 : -1) * 1.4 * k;
            }
            b.dy *= Math.pow(0.97, k);
            if (b.x > W + 60) Object.assign(b, makeBird(false));
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const l of leaves) drawLeaf(l);
        for (const b of birds) drawBird(b);
    }

    function frame(now) {
        if (!running) return;
        const dt = Math.min(50, now - (last || now));
        last = now;
        step(dt);
        draw();
        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (running || reduceMotion) return;
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    // Pointer events are read from the header, so the text and tiles stay fully clickable.
    header.addEventListener("pointermove", e => {
        const r = header.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
        pointer.active = true;
    });
    header.addEventListener("pointerleave", () => { pointer.active = false; });
    header.addEventListener("click", e => {
        if (e.target.closest("a, button, select")) return;
        gust = 2.4;
    });

    window.addEventListener("resize", resize);
    resize();
    if (reduceMotion) { draw(); return; }

    // Run only while the header is on screen and the tab is visible.
    let visible = true;
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            visible && !document.hidden ? start() : stop();
        }).observe(header);
    }
    document.addEventListener("visibilitychange", () => (document.hidden || !visible ? stop() : start()));
    start();
})();
