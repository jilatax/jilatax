// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://doc.jilatax.dev',
	integrations: [
		starlight({
			title: 'Jilatax',
			description: 'Documentation for the Jilatax framework for Lynx.',
			sidebar: [
				{
					label: 'Getting started',
					items: [
						{ label: 'Introduction', slug: '' },
						{ label: 'Installation', slug: 'getting-started/installation' },
					],
				},
				{
					label: 'Reference',
					items: [{ label: 'CLI', slug: 'reference/cli' }],
				},
			],
		}),
	],
});
