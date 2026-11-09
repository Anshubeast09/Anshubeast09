
const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");
const sidebar = document.getElementById("sidebar");
const pageName = document.getElementById("pageName");
const toast = document.getElementById("toast");

const privatePages = [
    "attendance",
    "calendar",
    "documents",
    "music",
    "notes"
];

function showPage(page) {

    pages.forEach(section => {
        section.classList.remove("active");
    });

    navLinks.forEach(link => {
        link.classList.remove("active");
    });

    const target = document.getElementById(page);

    if (target) {
        target.classList.add("active");
    } else if (privatePages.includes(page)) {
        document.getElementById("lockedPage").classList.add("active");

        const title = page.charAt(0).toUpperCase() + page.slice(1);

        document.getElementById("lockedTitle").textContent = title;
    }

    const selectedLink = document.querySelector(
        `.nav-link[data-page="${page}"]`
    );

    if (selectedLink) {
        selectedLink.classList.add("active");
    }

    pageName.textContent =
        page.charAt(0).toUpperCase() + page.slice(1);

    sidebar.classList.remove("open");

    window.location.hash = page;
}

function showToast(message) {

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// Sidebar navigation

navLinks.forEach(link => {

    link.addEventListener("click", function(event) {

        event.preventDefault();

        const page = this.dataset.page;

        showPage(page);
    });

});

// Public page buttons

document.querySelectorAll("[data-open]").forEach(button => {

    button.addEventListener("click", function() {

        showPage(this.dataset.open);

    });

});

// Locked tools

document.querySelectorAll(".tool-btn").forEach(button => {

    button.addEventListener("click", function() {

        const card = this.closest(".tool-card");

        const tool = card.dataset.tool;

        showToast(tool + " is coming soon!");

    });

});

// Mobile menu

document.getElementById("menuBtn").addEventListener("click", () => {

    sidebar.classList.toggle("open");

});

// Close menu when clicking outside

document.addEventListener("click", function(event) {

    const menuButton = document.getElementById("menuBtn");

    if (
        window.innerWidth <= 850 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        !menuButton.contains(event.target)
    ) {
        sidebar.classList.remove("open");
    }

});

// Browser back and forward navigation

window.addEventListener("hashchange", () => {

    const page = window.location.hash.substring(1);

    const validPages = [
        "home",
        "about",
        "projects",
        "friends",
        ...privatePages
    ];

    if (validPages.includes(page)) {
        showPage(page);
    }

});

// Load requested page

const initialPage = window.location.hash.substrin g(1);

const validPages = [
    "home",
    "about",
    "projects",
    "friends",
    ...privatePages
];

showPage(validPages.includes(initialPage) ? initialPage : "home");
