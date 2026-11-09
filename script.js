
// =====================================
// AADARSH HUB - SUPABASE CONNECTION
// =====================================

const SUPABASE_URL = "sb_secret_h9FnW1ihCXxm6G5oqPrkJQ_pAgC0xbx";
const SUPABASE_KEY = "sb_publishable_sloNZpolPF-7mv0i0kxErQ_iPf3jKmk";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let selectedLogin = "";

function openLogin(type) {
    selectedLogin = type;

    document.getElementById("login-title").textContent =
        type === "owner" ? "Owner Login" : "Member Login";

    document.getElementById("login-panel").classList.remove("hidden");
    document.getElementById("login-message").textContent = "";

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";

    document.getElementById("username").type = "email";
    document.querySelector('label[for="username"]')?.remove();

    document.getElementById("username").placeholder = "Enter registered email";

    document.getElementById("login-panel").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function closeLogin() {
    document.getElementById("login-panel").classList.add("hidden");
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const message = document.getElementById("login-message");

    message.textContent = "Signing in...";

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

    if (error) {
        message.textContent = error.message;
        return;
    }

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("username, role")
            .eq("id", data.user.id)
            .single();

    if (profileError || !profile) {
        await supabaseClient.auth.signOut();
        message.textContent = "Account profile not found.";
        return;
    }

    if (
        (selectedLogin === "owner" && profile.role !== "owner") ||
        (selectedLogin === "member" && profile.role !== "member")
    ) {
        await supabaseClient.auth.signOut();
        message.textContent = "You are not authorized for this login.";
        return;
    }

    message.style.color = "#8be0a5";
    message.textContent =
        "Welcome, " + profile.username + "! Login successful.";

    console.log("Authenticated user:", profile.username);
    console.log("Role:", profile.role);

    // Next step: Open the private dashboard.
}
