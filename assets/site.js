"use strict";
function query(selector) {
    return document.querySelector(selector);
}
function queryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
}
function formatBytes(bytes) {
    if (!bytes || !Number.isFinite(bytes))
        return "Installer";
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(value) {
    if (!value)
        return "latest build";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "latest build";
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
function formatUsd(value) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}
const platformIcons = {
    macos: `<svg class="platform-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.64 12.08c-.03-2.32 1.9-3.45 1.99-3.5-1.09-1.6-2.79-1.82-3.37-1.84-1.42-.15-2.8.85-3.52.85-.74 0-1.86-.83-3.06-.8-1.56.02-3.02.93-3.82 2.35-1.65 2.86-.42 7.06 1.16 9.37.79 1.13 1.71 2.39 2.92 2.35 1.18-.05 1.62-.75 3.04-.75 1.41 0 1.82.75 3.06.72 1.27-.02 2.06-1.14 2.82-2.28.91-1.3 1.27-2.58 1.29-2.65-.03-.01-2.49-.96-2.52-3.82ZM14.34 5.24c.64-.79 1.07-1.86.95-2.94-.92.04-2.07.63-2.74 1.39-.59.67-1.12 1.78-.98 2.81 1.04.08 2.1-.52 2.77-1.26Z" />
    </svg>`,
    windows: `<svg class="platform-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5.15 10.8 4v7.38H3V5.15Z" />
      <path d="M12.15 3.82 21 2.5v8.88h-8.85V3.82Z" />
      <path d="M3 12.62h7.8V20L3 18.85v-6.23Z" />
      <path d="M12.15 12.62H21v8.88l-8.85-1.32v-7.56Z" />
    </svg>`,
    linux: `<img class="platform-logo linux-logo" src="../assets/linux-tux.png" alt="" width="36" height="43" />`,
};
const platformMeta = {
    macos: {
        className: "macos",
        eyebrow: "macOS",
        title: "Apple Mac",
        icon: platformIcons.macos,
    },
    windows: {
        className: "windows",
        eyebrow: "Windows",
        title: "Windows PC",
        icon: platformIcons.windows,
    },
    linux: {
        className: "linux",
        eyebrow: "Linux",
        title: "Linux desktop",
        icon: platformIcons.linux,
    },
};
const platformOrder = ["macos", "windows", "linux"];
let clientDeviceHintPromise = null;
// Add languages here; the header switcher, footer switcher, and alternate links
// are generated from this list.
const siteLanguages = [
    {
        code: "en",
        hreflang: "en-US",
        shortLabel: "EN",
        label: "English",
        flag: "🇺🇸",
        pathPrefix: "",
    },
    {
        code: "fr",
        hreflang: "fr-FR",
        shortLabel: "FR",
        label: "Français",
        flag: "🇫🇷",
        pathPrefix: "/fr",
    },
];
const defaultSiteLanguage = siteLanguages[0];
const siteIconPaths = {
    Product: `<path d="M4 7h16" /><path d="M7 7v12h10V7" /><path d="M9 7V5h6v2" />`,
    Individuals: `<circle cx="12" cy="7" r="3" /><path d="M6 21a6 6 0 0 1 12 0" />`,
    Business: `<rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2" /><path d="M4 12h16" />`,
    Resources: `<circle cx="12" cy="12" r="8" /><path d="m15 9-2 5-5 2 2-5 5-2Z" />`,
    Research: `<path d="M9 3h6" /><path d="M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3" /><path d="M8.5 14h7" />`,
    Organization: `<path d="M4 20h16" /><path d="M6 20V5h9v15" /><path d="M15 10h3v10" /><path d="M9 9h3" /><path d="M9 13h3" /><path d="M9 17h3" />`,
    Community: `<path d="M16 11a3 3 0 1 0-6 0" /><path d="M7 20a5 5 0 0 1 10 0" /><path d="M6 12a2 2 0 1 0 0-4" /><path d="M18 8a2 2 0 1 0 0 4" /><path d="M3 20a4 4 0 0 1 4-4" /><path d="M17 16a4 4 0 0 1 4 4" />`,
    Download: `<path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 20h14" />`,
    Editor: `<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13 7 4 4" />`,
    Blogpost: `<path d="M5 4h14v16H5z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" />`,
    Desktop: `<rect x="4" y="5" width="16" height="11" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" />`,
    About: `<circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />`,
    Docs: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M8 7h8" /><path d="M8 11h8" />`,
    Downloads: `<path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 20h14" />`,
    Store: `<path d="M5 10h14l-1 10H6L5 10Z" /><path d="M8 10a4 4 0 0 1 8 0" />`,
    Benchmarks: `<path d="M4 19V5" /><path d="M4 19h16" /><rect x="7" y="11" width="3" height="5" rx="1" /><rect x="12" y="8" width="3" height="8" rx="1" /><rect x="17" y="6" width="3" height="10" rx="1" />`,
    Compiler: `<path d="m10 8-4 4 4 4" /><path d="m14 8 4 4-4 4" /><path d="M12 5l-2 14" />`,
    "Knowledge Graph": `<circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="17" r="2" /><path d="M8 8l3 7" /><path d="M16 8l-3 7" /><path d="M8 7h8" />`,
    AI: `<path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 14l2-5 2 5" /><path d="M10.8 12.5h2.4" />`,
    Sitemap: `<path d="M12 4v5" /><path d="M6 14v-3h12v3" /><rect x="9" y="2" width="6" height="4" rx="1" /><rect x="3" y="14" width="6" height="6" rx="1" /><rect x="15" y="14" width="6" height="6" rx="1" />`,
    Privacy: `<rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />`,
    Terms: `<path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v5h5" /><path d="M10 12h6" /><path d="M10 16h6" />`,
    Contact: `<rect x="4" y="6" width="16" height="12" rx="2" /><path d="m4 8 8 6 8-6" />`,
    Source: `<circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8" /><path d="M8 18h6a4 4 0 0 0 4-4V8" />`,
    Donate: `<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />`,
    LinkedIn: `<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 11v5" /><path d="M8 8h.01" /><path d="M12 16v-5" /><path d="M16 16v-3a2 2 0 0 0-4 0" />`,
};
function getSiteIconPath(label) {
    const baseLabel = label.replace(/\s+Pro$/, "");
    return siteIconPaths[label] ?? siteIconPaths[baseLabel];
}
function createSiteIcon(className, icon) {
    const iconEl = document.createElement("span");
    iconEl.className = className;
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${icon}</svg>`;
    return iconEl;
}
function normalizePathPrefix(prefix) {
    if (!prefix || prefix === "/")
        return "";
    return `/${prefix.replace(/^\/+|\/+$/g, "")}`;
}
function getCurrentSiteLanguage() {
    const pathname = window.location.pathname;
    return (siteLanguages.find((language) => {
        const prefix = normalizePathPrefix(language.pathPrefix);
        return Boolean(prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
    }) ?? defaultSiteLanguage);
}
function getLanguageNeutralPath(pathname, language) {
    const prefix = normalizePathPrefix(language.pathPrefix);
    if (!prefix)
        return pathname || "/";
    if (pathname === prefix)
        return "/";
    if (pathname.startsWith(`${prefix}/`))
        return pathname.slice(prefix.length) || "/";
    return pathname || "/";
}
function getLocalizedPath(language, includeState = true) {
    const currentLanguage = getCurrentSiteLanguage();
    const neutralPath = getLanguageNeutralPath(window.location.pathname, currentLanguage);
    const prefix = normalizePathPrefix(language.pathPrefix);
    const path = prefix
        ? `${prefix}${neutralPath === "/" ? "/" : neutralPath}`
        : neutralPath;
    if (!includeState)
        return path;
    return `${path}${window.location.search}${window.location.hash}`;
}
function getCanonicalOrigin() {
    const canonical = query('link[rel="canonical"]');
    if (canonical?.href) {
        try {
            return new URL(canonical.href).origin;
        }
        catch {
            return window.location.origin;
        }
    }
    return window.location.origin;
}
function createLanguageOption(language, currentLanguage, showName = false) {
    const link = document.createElement("a");
    link.className = "language-option";
    link.href = getLocalizedPath(language);
    link.hreflang = language.hreflang;
    link.lang = language.hreflang;
    link.setAttribute("aria-label", `Switch to ${language.label}`);
    if (language.code === currentLanguage.code) {
        link.setAttribute("aria-current", "true");
    }
    const flag = document.createElement("span");
    flag.className = "language-flag";
    flag.setAttribute("aria-hidden", "true");
    flag.textContent = language.flag;
    link.append(flag);
    const code = document.createElement("span");
    code.className = "language-code";
    code.textContent = language.shortLabel;
    link.append(code);
    if (showName) {
        const name = document.createElement("span");
        name.className = "language-name";
        name.textContent = language.label;
        link.append(name);
    }
    link.addEventListener("click", () => {
        localStorage.setItem("latexdo-language", language.code);
    });
    return link;
}
function createGlobeIcon() {
    const icon = document.createElement("span");
    icon.className = "language-globe";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "🌐";
    return icon;
}
function createLanguageSwitcher(location) {
    const switcher = document.createElement("nav");
    switcher.className = `language-switcher ${location}-language-switcher`;
    switcher.setAttribute("aria-label", "Languages");
    switcher.dataset.languageSwitcher = location;
    const trigger = document.createElement("button");
    trigger.className = "language-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.append(createGlobeIcon());
    switcher.append(trigger);
    renderLanguageSwitcher(switcher, location);
    return switcher;
}
function renderLanguageSwitcher(switcher, location) {
    const currentLanguage = getCurrentSiteLanguage();
    let trigger = switcher.querySelector(".language-trigger");
    if (!trigger) {
        trigger = document.createElement("button");
        trigger.className = "language-trigger";
        trigger.type = "button";
        trigger.setAttribute("aria-haspopup", "true");
        trigger.prepend(createGlobeIcon());
        switcher.prepend(trigger);
    }
    trigger.setAttribute("aria-label", `Languages, current language: ${currentLanguage.label}`);
    trigger.setAttribute("aria-expanded", "false");
    trigger.querySelector(".language-current")?.remove();
    const current = document.createElement("span");
    current.className = "language-current";
    current.textContent = currentLanguage.shortLabel;
    trigger.append(current);
    const list = document.createElement("ul");
    list.className = "language-list";
    siteLanguages.forEach((language) => {
        const item = document.createElement("li");
        item.className = "language-item";
        item.append(createLanguageOption(language, currentLanguage, location === "footer"));
        list.append(item);
    });
    switcher.querySelector(".language-list")?.remove();
    switcher.append(list);
}
function syncLanguageTriggerState(switcher) {
    const trigger = switcher.querySelector(".language-trigger");
    if (!trigger)
        return;
    const open = switcher.matches(":hover") ||
        switcher.matches(":focus-within") ||
        switcher.classList.contains("is-open");
    trigger.setAttribute("aria-expanded", String(open));
}
function bindLanguageSwitcher(switcher) {
    if (switcher.dataset.languageSwitcherBound === "true")
        return;
    switcher.dataset.languageSwitcherBound = "true";
    const trigger = switcher.querySelector(".language-trigger");
    trigger?.addEventListener("click", (event) => {
        event.preventDefault();
        const open = !switcher.classList.contains("is-open");
        queryAll(".language-switcher.is-open").forEach((openSwitcher) => {
            if (openSwitcher !== switcher) {
                openSwitcher.classList.remove("is-open");
                syncLanguageTriggerState(openSwitcher);
            }
        });
        switcher.classList.toggle("is-open", open);
        syncLanguageTriggerState(switcher);
    });
    switcher.querySelectorAll(".language-option").forEach((option) => {
        option.addEventListener("click", () => {
            switcher.classList.remove("is-open");
            syncLanguageTriggerState(switcher);
        });
    });
    ["mouseenter", "mouseleave", "focusin", "focusout"].forEach((eventName) => {
        switcher.addEventListener(eventName, () => {
            window.setTimeout(() => syncLanguageTriggerState(switcher), 0);
        });
    });
}
function initLanguageAlternates() {
    const origin = getCanonicalOrigin();
    queryAll('link[data-language-alternate="true"]').forEach((link) => {
        link.remove();
    });
    siteLanguages.forEach((language) => {
        const alternate = document.createElement("link");
        alternate.rel = "alternate";
        alternate.hreflang = language.hreflang;
        alternate.href = new URL(getLocalizedPath(language, false), origin).href;
        alternate.dataset.languageAlternate = "true";
        document.head.append(alternate);
    });
    const fallback = document.createElement("link");
    fallback.rel = "alternate";
    fallback.hreflang = "x-default";
    fallback.href = new URL(getLocalizedPath(defaultSiteLanguage, false), origin).href;
    fallback.dataset.languageAlternate = "true";
    document.head.append(fallback);
}
function initLanguageSwitcher() {
    const currentLanguage = getCurrentSiteLanguage();
    document.documentElement.lang = currentLanguage.hreflang;
    queryAll("[data-language-switcher]").forEach((switcher) => {
        const navShell = query(".nav-shell");
        if (switcher.dataset.languageSwitcher === "header" &&
            switcher.closest("[data-nav-links]") &&
            navShell) {
            navShell.append(switcher);
        }
        renderLanguageSwitcher(switcher, switcher.dataset.languageSwitcher === "footer" ? "footer" : "header");
        bindLanguageSwitcher(switcher);
    });
    const navShell = query(".nav-shell");
    if (navShell && !navShell.querySelector(".header-language-switcher")) {
        const switcher = createLanguageSwitcher("header");
        navShell.append(switcher);
        bindLanguageSwitcher(switcher);
    }
    const footerBottom = query(".footer-bottom");
    if (footerBottom && !footerBottom.querySelector(".footer-language-switcher")) {
        const switcher = createLanguageSwitcher("footer");
        footerBottom.append(switcher);
        bindLanguageSwitcher(switcher);
    }
    document.addEventListener("click", (event) => {
        if (event.target.closest(".language-switcher"))
            return;
        queryAll(".language-switcher.is-open").forEach((switcher) => {
            switcher.classList.remove("is-open");
            syncLanguageTriggerState(switcher);
        });
    });
    initLanguageAlternates();
}
function initNavigation() {
    const toggle = query("[data-nav-toggle]");
    const links = query("[data-nav-links]");
    if (!toggle || !links)
        return;
    queryAll(".nav-links a").forEach((link) => {
        const label = link.textContent?.trim() ?? "";
        const icon = siteIconPaths[label];
        if (!icon || link.querySelector(".header-link-icon"))
            return;
        link.prepend(createSiteIcon("header-link-icon", icon));
    });
    toggle.addEventListener("click", () => {
        const open = !links.classList.contains("open");
        links.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            links.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }
    });
}
function initEditorPreviewNotice() {
    queryAll(".nav-editor-link").forEach((link) => {
        link.addEventListener("click", () => {
            window.alert("LatexDo Editor is currently in preview.");
        });
    });
}
function initReveal() {
    const elements = queryAll(".reveal");
    if (!("IntersectionObserver" in window)) {
        elements.forEach((element) => element.classList.add("visible"));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.18 });
    elements.forEach((element) => observer.observe(element));
}
function renderDownloadFallback(container) {
    container.innerHTML = `
    <article class="download-card">
      <h3>Downloads page</h3>
      <p>Open the direct downloads page for macOS and Windows installers.</p>
      <a class="button primary" href="downloads/">View downloads</a>
    </article>
    <article class="download-card">
      <h3>Update manifest</h3>
      <p>The desktop app checks the public manifest for update information.</p>
      <a class="button secondary" href="downloads/manifest.json">View manifest</a>
    </article>
    <article class="download-card">
      <h3>Checksums</h3>
      <p>Verify installer integrity with SHA-256 checksums from the website.</p>
      <a class="button secondary" href="downloads/SHA256SUMS.txt">View checksums</a>
    </article>`;
}
async function initDownloads() {
    const container = query("#download-grid");
    if (!container)
        return;
    try {
        const response = await fetch("downloads/manifest.json", { cache: "no-store" });
        if (!response.ok)
            throw new Error(`Manifest returned ${response.status}`);
        const manifest = (await response.json());
        const files = Array.isArray(manifest.files) ? manifest.files : [];
        if (!files.length) {
            renderDownloadFallback(container);
            return;
        }
        container.innerHTML = files
            .map((file) => {
            const label = escapeHtml(file.label || file.id);
            const note = escapeHtml(file.note || `${file.platform} ${file.arch}`);
            const meta = escapeHtml(`${file.sizeLabel ?? formatBytes(file.size)} · ${formatDate(manifest.publishedAt)}`);
            const url = escapeHtml(file.url || `downloads/files/${file.filename}`);
            return `<article class="download-card">
          <div>
            <h3>${label}</h3>
            <p>${note}</p>
            <small>${meta}</small>
          </div>
          <a class="button primary" href="${url}">Download</a>
        </article>`;
        })
            .join("");
    }
    catch {
        renderDownloadFallback(container);
    }
}
function getPlatformMeta(platform) {
    const normalized = platform.toLowerCase();
    if (platformMeta[normalized])
        return platformMeta[normalized];
    const label = normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "Other";
    return {
        className: normalized,
        eyebrow: label,
        title: `${label} build`,
        icon: platformIcons.linux,
    };
}
function normalizeClientPlatform(value) {
    const normalized = value.toLowerCase();
    if (/(mac|macos)/.test(normalized))
        return "macos";
    if (/(win|windows)/.test(normalized))
        return "windows";
    if (/(linux|x11)/.test(normalized) && !/android/.test(normalized))
        return "linux";
    return null;
}
function normalizeClientArch(value, bitness = "") {
    const normalized = `${value} ${bitness}`.toLowerCase();
    if (/(arm|aarch64)/.test(normalized))
        return "arm64";
    if (/(x86|x64|amd64|wow64|win64|64)/.test(normalized))
        return "x64";
    return null;
}
function getNavigatorUAData() {
    return navigator.userAgentData ?? null;
}
function detectClientDeviceFromBrowser() {
    const uaData = getNavigatorUAData();
    const platformText = [
        uaData?.platform,
        navigator.platform,
        navigator.userAgent,
    ]
        .filter(Boolean)
        .join(" ");
    const platform = normalizeClientPlatform(platformText);
    return {
        platform,
        arch: platform === "macos" ? null : normalizeClientArch(platformText),
    };
}
async function detectClientDevice() {
    const basic = detectClientDeviceFromBrowser();
    const uaData = getNavigatorUAData();
    if (!uaData?.getHighEntropyValues)
        return basic;
    try {
        const values = await uaData.getHighEntropyValues([
            "architecture",
            "bitness",
            "platform",
        ]);
        return {
            platform: normalizeClientPlatform(values.platform ?? "") ?? basic.platform,
            arch: normalizeClientArch(values.architecture ?? "", values.bitness ?? "") ??
                basic.arch,
        };
    }
    catch {
        return basic;
    }
}
function getClientDeviceHint() {
    clientDeviceHintPromise ??= detectClientDevice();
    return clientDeviceHintPromise;
}
function getPlatformCardPlatform(card) {
    if (card.dataset.platform)
        return card.dataset.platform;
    return (platformOrder.find((platform) => {
        const className = getPlatformMeta(platform).className;
        return card.classList.contains(className);
    }) ?? null);
}
function setDownloadOptionDisabled(option, disabled) {
    if (disabled) {
        option.removeAttribute("href");
        option.removeAttribute("download");
        option.setAttribute("aria-disabled", "true");
        option.setAttribute("tabindex", "-1");
        option.classList.add("is-disabled");
        return;
    }
    option.removeAttribute("aria-disabled");
    option.removeAttribute("tabindex");
    option.classList.remove("is-disabled");
}
function applyDevicePlatformLimit(container, deviceHint) {
    const detectedPlatform = deviceHint?.platform ?? null;
    const cards = Array.from(container.querySelectorAll(".platform-download-card"));
    const shouldLimit = Boolean(detectedPlatform &&
        cards.some((card) => getPlatformCardPlatform(card) === detectedPlatform));
    container.classList.toggle("is-device-limited", shouldLimit);
    cards.forEach((card) => {
        const disabled = shouldLimit && getPlatformCardPlatform(card) !== detectedPlatform;
        card.classList.toggle("is-device-disabled", disabled);
        if (disabled) {
            card.setAttribute("aria-disabled", "true");
        }
        else {
            card.removeAttribute("aria-disabled");
        }
        card.querySelectorAll(".download-option").forEach((option) => {
            setDownloadOptionDisabled(option, disabled);
        });
        card.querySelectorAll(".mac-machine-input").forEach((input) => {
            input.disabled = disabled;
        });
    });
}
async function initDownloadPlatformLimits() {
    const containers = queryAll(".download-platform-grid");
    if (!containers.length)
        return;
    const deviceHint = await getClientDeviceHint();
    containers.forEach((container) => applyDevicePlatformLimit(container, deviceHint));
}
function getDownloadOptionLabel(file) {
    if (file.platform === "macos" && file.arch === "arm64")
        return "Apple Silicon";
    if (file.platform === "macos" && file.arch === "x64")
        return "Intel";
    if (file.arch)
        return `${file.label || file.platform} ${file.arch.toUpperCase()}`;
    return file.label || file.id;
}
function getInstallerType(file) {
    const extension = file.filename.split(".").pop();
    if (!extension)
        return "Installer";
    return `${extension.toUpperCase()} installer`;
}
function getReleasePath(release) {
    return release.downloadsPage || `${release.tag}/`;
}
function getReleaseManifestPath(release) {
    return release.manifestUrl || `${release.tag}/manifest.json`;
}
function getReleaseChecksumsPath(release) {
    return release.checksumsUrl || `${release.tag}/SHA256SUMS.txt`;
}
function getReleaseGithubPath(release) {
    return release.githubReleaseUrl || `https://github.com/latexdo/latexdo/releases/tag/${release.tag}`;
}
function getShortCommit(release) {
    return (release.commit || "").slice(0, 12) || "Unknown";
}
function renderDownloadOption(file, extraClass = "", disabled = false) {
    const label = escapeHtml(getDownloadOptionLabel(file));
    const type = escapeHtml(getInstallerType(file));
    const size = escapeHtml(file.sizeLabel ?? formatBytes(file.size));
    const sha = file.sha256 ? `<span class="downloads-dev-link"> - SHA-256</span>` : "";
    const url = escapeHtml(file.url || file.filename);
    const className = ["download-option", extraClass, disabled ? "is-disabled" : ""]
        .filter(Boolean)
        .join(" ");
    const attributes = disabled ? `aria-disabled="true" tabindex="-1"` : `href="${url}" download`;
    return `<a class="${escapeHtml(className)}" ${attributes}>
              <strong>${label}</strong>
              <span>${type}</span>
              <em>${size}${sha}</em>
            </a>`;
}
function renderMacMachinePicker(files, deviceHint, disabled = false) {
    const appleSilicon = files.find((file) => file.arch === "arm64");
    const intel = files.find((file) => file.arch === "x64");
    if (!appleSilicon || !intel) {
        return `<div class="download-variant-row" aria-label="macOS build choices">
${files.map((file) => renderDownloadOption(file, "", disabled)).join("\n")}
            </div>`;
    }
    const preferIntel = deviceHint?.platform === "macos" && deviceHint.arch === "x64";
    const disabledAttribute = disabled ? " disabled" : "";
    return `<div class="mac-machine-picker" aria-label="macOS build choices">
              <input class="mac-machine-input" type="radio" name="mac-machine" id="mac-machine-apple-silicon"${preferIntel ? "" : " checked"}${disabledAttribute} />
              <input class="mac-machine-input" type="radio" name="mac-machine" id="mac-machine-intel"${preferIntel ? " checked" : ""}${disabledAttribute} />
              <div class="mac-machine-tabs" aria-label="Mac chip">
                <label for="mac-machine-apple-silicon">Apple Silicon</label>
                <label for="mac-machine-intel">Intel</label>
              </div>
              <div class="mac-machine-downloads">
${renderDownloadOption(appleSilicon, "mac-machine-option arm64", disabled)}
${renderDownloadOption(intel, "mac-machine-option x64", disabled)}
              </div>
            </div>`;
}
function renderPlatformDownloadChoices(platform, options, deviceHint, disabled = false) {
    if (platform === "macos")
        return renderMacMachinePicker(options, deviceHint, disabled);
    const meta = getPlatformMeta(platform);
    return `<div class="download-variant-row" aria-label="${escapeHtml(meta.eyebrow)} build choices">
${options.map((file) => renderDownloadOption(file, "", disabled)).join("\n")}
            </div>`;
}
function renderReleaseDownloads(container, release, deviceHint = null) {
    const files = Array.isArray(release.files) ? release.files : [];
    if (!files.length) {
        container.classList.remove("is-device-limited");
        container.innerHTML = `<article class="downloads-empty">
      <h2>No installers listed</h2>
      <p>This release tag does not include downloadable desktop installers.</p>
    </article>`;
        return;
    }
    const grouped = new Map();
    files.forEach((file) => {
        const platform = file.platform || "other";
        const group = grouped.get(platform) ?? [];
        group.push(file);
        grouped.set(platform, group);
    });
    const platforms = Array.from(grouped.keys()).sort((a, b) => {
        const aIndex = platformOrder.indexOf(a);
        const bIndex = platformOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1)
            return a.localeCompare(b);
        if (aIndex === -1)
            return 1;
        if (bIndex === -1)
            return -1;
        return aIndex - bIndex;
    });
    const detectedPlatform = deviceHint?.platform ?? null;
    const shouldLimit = Boolean(detectedPlatform && grouped.has(detectedPlatform));
    container.classList.toggle("is-device-limited", shouldLimit);
    container.innerHTML = platforms
        .map((platform) => {
        const meta = getPlatformMeta(platform);
        const options = grouped.get(platform) ?? [];
        const disabled = shouldLimit && detectedPlatform !== platform;
        const disabledClass = disabled ? " is-device-disabled" : "";
        const disabledAttribute = disabled ? ` aria-disabled="true"` : "";
        return `<article class="platform-download-card ${escapeHtml(meta.className)}${disabledClass}" data-platform="${escapeHtml(platform)}"${disabledAttribute}>
            <div class="platform-card-top">
              <span class="platform-logo-shell">${meta.icon}</span>
              <div>
                <p class="eyebrow">${escapeHtml(meta.eyebrow)}</p>
                <h2>${escapeHtml(meta.title)}</h2>
              </div>
            </div>
            ${renderPlatformDownloadChoices(platform, options, deviceHint, disabled)}
          </article>`;
    })
        .join("");
}
function renderReleaseMeta(container, release) {
    const version = escapeHtml(release.version || release.tag);
    const tag = escapeHtml(release.tag);
    const publishedAt = escapeHtml(release.publishedAt || "Unknown");
    const commit = escapeHtml(getShortCommit(release));
    const releasePath = escapeHtml(getReleasePath(release));
    const manifestPath = escapeHtml(getReleaseManifestPath(release));
    const checksumsPath = escapeHtml(getReleaseChecksumsPath(release));
    const githubPath = escapeHtml(getReleaseGithubPath(release));
    container.innerHTML = `<h2>Selected build information</h2>
        <dl>
          <div>
            <dt>Version</dt>
            <dd>${version}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>${publishedAt}</dd>
          </div>
          <div>
            <dt>Commit</dt>
            <dd>${commit}</dd>
          </div>
        </dl>
        <p>
          Selected tag: <a href="${releasePath}">${tag}</a>.
          For automated checks, use <a href="${manifestPath}">manifest.json</a>,
          <a href="${checksumsPath}">SHA256SUMS.txt</a>, and
          <a href="${githubPath}">GitHub release</a>.
        </p>`;
}
function getReleaseGroupLabel(release) {
    const version = release.version || release.tag.replace(/-build\..*$/, "");
    return version.startsWith("v") ? version : `v${version}`;
}
function groupReleasesByVersion(releases) {
    const groups = new Map();
    releases.forEach((release, index) => {
        const label = getReleaseGroupLabel(release);
        const items = groups.get(label) ?? [];
        items.push({ release, index });
        groups.set(label, items);
    });
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
function renderReleaseBuildItem(release, index) {
    const latest = index === 0 ? " - latest" : "";
    const tag = escapeHtml(release.tag);
    const publishedAt = escapeHtml(formatDate(release.publishedAt));
    const commit = escapeHtml(getShortCommit(release));
    const releasePath = escapeHtml(getReleasePath(release));
    const manifestPath = escapeHtml(getReleaseManifestPath(release));
    const checksumsPath = escapeHtml(getReleaseChecksumsPath(release));
    const githubPath = escapeHtml(getReleaseGithubPath(release));
    return `<article class="release-item">
              <button class="release-build-button" type="button" data-release-index="${index}">
                <strong>${tag}</strong>
                <span>${publishedAt}${latest} - ${commit}</span>
              </button>
              <nav aria-label="${tag} release links">
                <a href="${releasePath}">Downloads</a>
                <a href="${manifestPath}">Manifest</a>
                <a href="${checksumsPath}">Checksums</a>
                <a href="${githubPath}">GitHub</a>
              </nav>
            </article>`;
}
function renderReleaseGroups(releases) {
    return groupReleasesByVersion(releases)
        .map((group, groupIndex) => {
        const buildCount = group.items.length;
        const latest = groupIndex === 0 ? " - latest series" : "";
        return `<details class="release-group">
              <summary>
                <span class="release-group-arrow" aria-hidden="true"></span>
                <span class="release-group-title">
                  <strong>${escapeHtml(group.label)}</strong>
                  <small>${buildCount} build${buildCount === 1 ? "" : "s"}${latest}</small>
                </span>
              </summary>
              <div class="release-list">
                ${group.items.map((item) => renderReleaseBuildItem(item.release, item.index)).join("")}
              </div>
            </details>`;
    })
        .join("");
}
function readReleaseHash() {
    const hash = window.location.hash.slice(1);
    if (!hash)
        return null;
    try {
        return decodeURIComponent(hash);
    }
    catch {
        return hash;
    }
}
async function initReleaseSwitcher() {
    const switcher = query("[data-release-switcher]");
    const groups = query("[data-release-groups]");
    const downloads = query("[data-release-downloads]");
    const meta = query("[data-release-meta]");
    if (!switcher || !groups || !downloads || !meta)
        return;
    const source = switcher.dataset.releasesSrc || "downloads/releases.json";
    const downloadsContainer = downloads;
    const metaContainer = meta;
    const deviceHint = await getClientDeviceHint();
    try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok)
            throw new Error(`Releases returned ${response.status}`);
        const index = (await response.json());
        const releases = Array.isArray(index.releases) ? index.releases : [];
        if (!releases.length)
            throw new Error("No releases");
        groups.innerHTML = renderReleaseGroups(releases);
        const buttons = queryAll(".release-build-button");
        function selectRelease(index, updateHash = true, openGroup = true) {
            const release = releases[index];
            const button = buttons.find((candidate) => Number(candidate.dataset.releaseIndex) === index);
            if (!release || !button)
                return;
            buttons.forEach((buildButton) => {
                const selected = Number(buildButton.dataset.releaseIndex) === index;
                buildButton.setAttribute("aria-current", String(selected));
                buildButton.closest(".release-item")?.classList.toggle("is-selected", selected);
            });
            renderReleaseDownloads(downloadsContainer, release, deviceHint);
            renderReleaseMeta(metaContainer, release);
            if (openGroup) {
                button.closest("details")?.setAttribute("open", "");
                button.scrollIntoView({ block: "nearest" });
            }
            if (updateHash) {
                const url = new URL(window.location.href);
                url.hash = encodeURIComponent(release.tag);
                window.history.replaceState(null, "", url);
            }
        }
        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                const releaseIndex = Number(button.dataset.releaseIndex);
                if (Number.isInteger(releaseIndex))
                    selectRelease(releaseIndex);
            });
        });
        groups.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                return;
            const selectedIndex = buttons.findIndex((button) => button.getAttribute("aria-current") === "true");
            const delta = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = Math.min(Math.max(selectedIndex + delta, 0), releases.length - 1);
            if (nextIndex !== selectedIndex) {
                event.preventDefault();
                selectRelease(nextIndex);
                buttons
                    .find((button) => Number(button.dataset.releaseIndex) === nextIndex)
                    ?.focus();
            }
        });
        const requestedTag = readReleaseHash();
        const initialIndex = requestedTag
            ? releases.findIndex((release) => release.tag === requestedTag)
            : 0;
        selectRelease(initialIndex >= 0 ? initialIndex : 0, false, requestedTag !== null);
    }
    catch {
        groups.innerHTML = `<p class="release-loading">Release builds could not load. Use releases.json directly.</p>`;
    }
}
function initDevMode() {
    const toggle = query("#dev-mode-toggle");
    if (!toggle)
        return;
    const sync = () => {
        document.body.classList.toggle("dev-mode-on", toggle.checked);
    };
    sync();
    toggle.addEventListener("change", sync);
}
function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '"' && quoted && next === '"') {
            value += '"';
            index += 1;
            continue;
        }
        if (char === '"') {
            quoted = !quoted;
            continue;
        }
        if (char === "," && !quoted) {
            row.push(value.trim());
            value = "";
            continue;
        }
        if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && next === "\n")
                index += 1;
            row.push(value.trim());
            if (row.some(Boolean))
                rows.push(row);
            row = [];
            value = "";
            continue;
        }
        value += char;
    }
    row.push(value.trim());
    if (row.some(Boolean))
        rows.push(row);
    return rows;
}
function parseExpenseRows(text) {
    const rows = parseCsv(text);
    const headers = rows.shift()?.map((header) => header.toLowerCase()) ?? [];
    const categoryIndex = headers.indexOf("category");
    const itemIndex = headers.indexOf("line item");
    const monthlyIndex = headers.indexOf("monthly usd");
    const whyIndex = headers.indexOf("why");
    return rows
        .map((row) => ({
        category: row[categoryIndex] || "Other",
        item: row[itemIndex] || "Expense",
        monthlyUsd: Number(row[monthlyIndex] || 0),
        why: row[whyIndex] || "",
    }))
        .filter((row) => Number.isFinite(row.monthlyUsd));
}
function renderExpensesTable(container, rows) {
    const total = rows.reduce((sum, row) => sum + row.monthlyUsd, 0);
    container.innerHTML = `<table class="expenses-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Line item</th>
          <th>Monthly USD</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        ${rows
        .map((row) => `<tr>
              <td>${escapeHtml(row.category)}</td>
              <td>${escapeHtml(row.item)}</td>
              <td>${escapeHtml(formatUsd(row.monthlyUsd))}</td>
              <td>${escapeHtml(row.why)}</td>
            </tr>`)
        .join("")}
      </tbody>
      <tfoot>
        <tr>
          <th colspan="2">Estimated monthly total</th>
          <td>${escapeHtml(formatUsd(total))}</td>
          <td aria-hidden="true"></td>
        </tr>
      </tfoot>
    </table>`;
}
async function initExpensesTable() {
    const container = query("[data-expenses-table]");
    if (!container)
        return;
    const source = container.dataset.expensesSrc || "expenses.csv";
    try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok)
            throw new Error(`Expenses returned ${response.status}`);
        const rows = parseExpenseRows(await response.text());
        if (!rows.length)
            throw new Error("No expenses");
        renderExpensesTable(container, rows);
    }
    catch {
        container.innerHTML = `<p class="expenses-loading">
      Expenses could not load. Open <a href="${escapeHtml(source)}">expenses.csv</a> directly.
    </p>`;
    }
}
function initCopyCommands() {
    const buttons = queryAll(".copy-btn");
    buttons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const command = btn.parentElement?.querySelector("code")?.textContent;
            if (!command)
                return;
            try {
                await navigator.clipboard.writeText(command);
                btn.classList.add("copied");
                btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                setTimeout(() => {
                    btn.classList.remove("copied");
                    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
                }, 2000);
            }
            catch {
                // Clipboard not available
            }
        });
    });
}
function initTheme() {
    const toggle = document.querySelector("[data-theme-toggle]");
    const html = document.documentElement;
    const saved = localStorage.getItem("theme");
    if (saved === "bw") {
        html.setAttribute("data-theme", "bw");
    }
    toggle?.addEventListener("click", () => {
        const isBw = html.getAttribute("data-theme") === "bw";
        if (isBw) {
            html.removeAttribute("data-theme");
            localStorage.setItem("theme", "");
        }
        else {
            html.setAttribute("data-theme", "bw");
            localStorage.setItem("theme", "bw");
        }
    });
}
function initFooter() {
    const year = new Date().getFullYear();
    const el = document.querySelector("#copyright") ?? document.querySelector("#copyright-year");
    if (el)
        el.textContent = String(year);
    queryAll(".site-footer h5").forEach((heading) => {
        const label = heading.textContent?.trim() ?? "";
        const icon = getSiteIconPath(label);
        if (!icon || heading.querySelector(".footer-heading-icon"))
            return;
        heading.prepend(createSiteIcon("footer-heading-icon", icon));
    });
    queryAll(".site-footer nav a, .footer-static-link").forEach((link) => {
        const label = link.textContent?.trim() ?? "";
        const icon = getSiteIconPath(label);
        if (!icon || link.querySelector(".footer-link-icon"))
            return;
        link.prepend(createSiteIcon("footer-link-icon", icon));
    });
}
function init() {
    initNavigation();
    initLanguageSwitcher();
    initEditorPreviewNotice();
    initReveal();
    initDevMode();
    void initDownloads();
    void initDownloadPlatformLimits();
    void initReleaseSwitcher();
    void initExpensesTable();
    initCopyCommands();
    initTheme();
    initFooter();
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
}
else {
    init();
}
