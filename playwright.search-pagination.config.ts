import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e/search-pagination', workers:1, retries:0,
  reporter:[['list'],['json',{outputFile:'reports/search-pagination/browser-results.json'}]],
  timeout:90000, expect:{timeout:20000},
  use:{baseURL:'http://127.0.0.1:3098',serviceWorkers:'block',trace:'retain-on-failure'},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:900}}},
    {name:'chromium-mobile',use:{...devices['Pixel 7']}},
    {name:'webkit-desktop',use:{...devices['Desktop Safari'],viewport:{width:1280,height:900}}},
    {name:'webkit-mobile',use:{...devices['iPhone 13']}}
  ]
});
