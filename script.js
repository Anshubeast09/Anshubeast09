// Supabase Initialize karo (Apne Supabase project settings se keys dalo)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Login Function
async function loginUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert("Login Failed: " + error.message);
    } else {
        // Login success, check role
        checkUserRoleAndRedirect(data.user.id);
    }
}

async function checkUserRoleAndRedirect(userId) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .single();

    if (profile.status === 'disabled') {
        alert("Aapka account owner ne disable kar diya hai.");
        await supabase.auth.signOut();
        return;
    }

    // Role ke hisaab se dashboard pe bhejo
    window.location.href = "dashboard.html";
}
