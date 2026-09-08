import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// Fallback page for SPA routing - Cloudflare Pages uses index.html
			fallback: 'index.html',
			precompress: false,
			strict: false
		})
	},
	files: {
		assets: 'static'
	}
};

export default config;
