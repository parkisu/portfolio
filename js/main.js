// Always start from the top after a full page reload.
// Hash navigation (for example index.html#projects) is left untouched.
(() => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const scrollToTopOnReload = () => {
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    const isReload = navigationEntry?.type === "reload";

    if (isReload && !window.location.hash) {
      window.scrollTo(0, 0);
    }
  };

  window.addEventListener("load", () => {
    scrollToTopOnReload();
    requestAnimationFrame(scrollToTopOnReload);
  });
})();

// Keep interactions small and dependency-free.
(() => {
  const modal = document.getElementById("video-modal");
  if (!modal) return;

  const player = modal.querySelector(".video-modal-player");
  const closeButton = modal.querySelector(".video-modal-close");
  const triggers = document.querySelectorAll(".video-trigger[data-video-src]");
  let activeTrigger = null;

  const closeModal = () => {
    if (modal.hidden) return;

    player.pause();
    try {
      player.currentTime = 0;
    } catch (error) {
      // Loading a not-yet-added placeholder video may not be seekable.
    }
    player.removeAttribute("src");
    player.load();
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("video-modal-open");

    if (activeTrigger) activeTrigger.focus();
    activeTrigger = null;
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      activeTrigger = trigger;
      player.src = trigger.dataset.videoSrc;
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("video-modal-open");
      player.load();
      closeButton.focus();
      const playRequest = player.play();
      if (playRequest && typeof playRequest.catch === "function") {
        playRequest.catch(() => {});
      }
    });
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      event.preventDefault();
      closeModal();
    }
  });
})();

// Keep the shared header theme in sync with the section passing beneath it.
(() => {
  const header = document.querySelector(".site-header");
  const sections = document.querySelectorAll("[data-header-theme]");
  if (!header || !sections.length) return;

  let updateFrame = 0;

  const updateTheme = () => {
    updateFrame = 0;
    const probeY = header.getBoundingClientRect().height / 2;
    let activeTheme = "";

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (!activeTheme && rect.top <= probeY && rect.bottom > probeY) {
        activeTheme = section.dataset.headerTheme;
      }
    });

    if (activeTheme) {
      header.dataset.theme = activeTheme;
    } else if (window.scrollY <= probeY) {
      header.dataset.theme = sections[0].dataset.headerTheme;
    }
  };

  const scheduleThemeUpdate = () => {
    if (updateFrame) return;
    updateFrame = requestAnimationFrame(updateTheme);
  };

  window.addEventListener("scroll", scheduleThemeUpdate, { passive: true });
  window.addEventListener("resize", scheduleThemeUpdate);
  scheduleThemeUpdate();
})();

// Smooth desktop wheel input with a frame-based target/easing loop.
// Touch movement itself never goes through this wheel handler.
(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchPrimary = window.matchMedia("(pointer: coarse) and (hover: none)");

  if (touchPrimary.matches) return;

  const timeConstant = 160;
  const wheelMultiplier = 0.85;
  const lineHeight = 40;
  let targetY = window.scrollY;
  let animationFrame = 0;
  let lastFrameTime = 0;
  const wheelScrollPositions = [];

  const scrollWithWheelEasing = (y) => {
    window.scrollTo(0, y);
    wheelScrollPositions.push({ y: window.scrollY, time: performance.now() });
    if (wheelScrollPositions.length > 16) wheelScrollPositions.shift();
  };

  const stopAnimation = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrameTime = 0;
    wheelScrollPositions.length = 0;
    root.classList.remove("wheel-inertia-active");
    targetY = window.scrollY;
  };

  const animateScroll = (time) => {
    const currentY = window.scrollY;
    const maxY = Math.max(0, root.scrollHeight - window.innerHeight);
    targetY = Math.max(0, Math.min(targetY, maxY));
    const distance = targetY - currentY;

    if (Math.abs(distance) < 0.75) {
      scrollWithWheelEasing(targetY);
      stopAnimation();
      return;
    }

    if (!lastFrameTime) lastFrameTime = time;
    const elapsed = Math.min(time - lastFrameTime, 50);
    lastFrameTime = time;
    const easing = 1 - Math.exp(-elapsed / timeConstant);

    scrollWithWheelEasing(currentY + distance * easing);
    animationFrame = requestAnimationFrame(animateScroll);
  };

  const handleWheel = (event) => {
    if (
      reducedMotion.matches ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.shiftKey ||
      event.deltaY === 0 ||
      root.classList.contains("video-modal-open")
    ) return;

    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, select, [contenteditable='true']")
    ) return;

    let deltaY = event.deltaY;
    if (event.deltaMode === 1) deltaY *= lineHeight;
    if (event.deltaMode === 2) deltaY *= window.innerHeight;
    deltaY *= wheelMultiplier;

    const currentTarget = animationFrame ? targetY : window.scrollY;
    const maxY = Math.max(0, root.scrollHeight - window.innerHeight);
    const nextTarget = Math.max(0, Math.min(currentTarget + deltaY, maxY));
    if (nextTarget === currentTarget) {
      if (animationFrame) event.preventDefault();
      return;
    }

    event.preventDefault();
    targetY = nextTarget;
    root.classList.add("wheel-inertia-active");

    if (!animationFrame) {
      lastFrameTime = performance.now();
      animationFrame = requestAnimationFrame(animateScroll);
    }
  };

  window.addEventListener("wheel", handleWheel, { passive: false });

  // Hand control back to native scrolling when its position differs from our own.
  window.addEventListener("scroll", () => {
    if (!animationFrame) return;

    const now = performance.now();
    while (wheelScrollPositions.length && now - wheelScrollPositions[0].time > 300) {
      wheelScrollPositions.shift();
    }

    const actualY = window.scrollY;
    const ownPositionIndex = wheelScrollPositions.findIndex(
      ({ y }) => Math.abs(y - actualY) < 1
    );

    if (ownPositionIndex !== -1) {
      wheelScrollPositions.splice(0, ownPositionIndex + 1);
      return;
    }

    stopAnimation();
  }, { passive: true });

  // A scrollbar press cancels easing before the native thumb starts moving.
  window.addEventListener("pointerdown", (event) => {
    if (!animationFrame) return;

    const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
    const edgeWidth = scrollbarWidth || 16;
    if (event.clientX >= window.innerWidth - edgeWidth) stopAnimation();
  }, { capture: true });

  // Cancel wheel easing before native anchor scrolling or keyboard scrolling starts.
  document.addEventListener("click", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest("a[href^='#'], .video-trigger")
    ) stopAnimation();
  });

  document.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
      stopAnimation();
    }
  });

  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) stopAnimation();
  });

  touchPrimary.addEventListener("change", (event) => {
    if (event.matches) stopAnimation();
  });
})();

/* Subtle one-time reveal for the main portfolio sections. */
(() => {
  if (!document.body || !document.querySelector("#projects")) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const items = [...document.querySelectorAll(
    "#services .section-heading, #services .service-row, #projects .section-heading, #projects .project-card, #video .section-heading, #video .video-card"
  )];

  if (!items.length || reducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-revealed"));
    return;
  }

  document.documentElement.classList.add("reveal-ready");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -7% 0px"
  });

  items.forEach((item) => observer.observe(item));
})();
