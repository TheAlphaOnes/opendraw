import { mount } from 'svelte'

import '@opendraw/editor/styles.css'
import './app.css'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })
