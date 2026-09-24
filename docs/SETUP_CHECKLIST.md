# Post-Deployment Manual Steps

Follow this checklist after deploying to Vercel to ensure everything is configured correctly:

- [ ] **Supabase Site URL**: Add your Vercel URL to **Supabase Auth → URL Configuration → Site URL**.
- [ ] **Redirect URLs**: Add your Vercel URL (e.g., `https://your-app.vercel.app/**`) to **Supabase Auth → URL Configuration → Redirect URLs**.
- [ ] **Admin Account**: Make yourself an admin by running the SQL provided in the README for your `user_id`.
- [ ] **Production Signup**: Test signup and profile creation on the production URL. Both the database trigger and AuthProvider currently create profiles; see the architecture known issues.
- [ ] **Google OAuth**: If enabled, ensure the Vercel URL is added to the Google Cloud Console authorized redirect URIs and Supabase Auth providers.
- [ ] **CSV Export**: Verify that exporting trades to CSV works on the production site.
- [ ] **Analytics**: Ensure charts render correctly with production data.
