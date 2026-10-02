import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../intent.js';

test('generic YouTube song', () => assert.deepEqual(parseIntent('play believer song'), {type:'PLAY_YOUTUBE',query:'believer'}));
test('generic YouTube video', () => assert.deepEqual(parseIntent('play GTA 6 trailer on YouTube'), {type:'PLAY_YOUTUBE',query:'gta 6 trailer'}));
test('natural YouTube request', () => assert.deepEqual(parseIntent('Can you open YouTube and play kesariya song?'), {type:'PLAY_YOUTUBE',query:'kesariya'}));
test('artist/song phrasing is generic', () => assert.equal(parseIntent('play Kesariya by Arijit Singh').type, 'PLAY_YOUTUBE'));
test('close browser tab', () => { assert.equal(parseIntent('close this browser tab').type,'CLOSE_TAB'); assert.equal(parseIntent('close youtube').type,'CLOSE_TAB'); assert.equal(parseIntent('close current tab').type,'CLOSE_TAB'); });
test('close active window', () => assert.equal(parseIntent('close this window').type,'CLOSE_WINDOW'));
test('Windows apps', () => { assert.deepEqual(parseIntent('open Chrome'),{type:'OPEN_APP',app:'chrome'}); assert.deepEqual(parseIntent('close Notepad'),{type:'CLOSE_APP',app:'notepad'}); assert.deepEqual(parseIntent('open settings'),{type:'OPEN_APP',app:'settings'}); });
test('system commands', () => { assert.deepEqual(parseIntent("what's the time"),{type:'GET_TIME'}); assert.deepEqual(parseIntent("today's date"),{type:'GET_DATE'}); assert.deepEqual(parseIntent('what year are we in'),{type:'GET_YEAR'}); assert.deepEqual(parseIntent('take a screenshot'),{type:'SCREENSHOT'}); assert.deepEqual(parseIntent('lock my PC'),{type:'LOCK_PC'}); });
test('volume and brightness', () => { assert.deepEqual(parseIntent('set volume to 40'),{type:'SET_VOLUME',value:40}); assert.deepEqual(parseIntent('brightness up'),{type:'BRIGHTNESS_UP'}); assert.deepEqual(parseIntent('set brightness to 70'),{type:'SET_BRIGHTNESS',value:70}); });
test('media controls', () => { assert.deepEqual(parseIntent('play'),{type:'MEDIA_TOGGLE'}); assert.deepEqual(parseIntent('next song'),{type:'MEDIA_NEXT'}); assert.deepEqual(parseIntent('previous track'),{type:'MEDIA_PREVIOUS'}); });
test('calculator and web search', () => { assert.deepEqual(parseIntent('calculate 12 + 4 * 2'),{type:'CALCULATE',expression:'12 + 4 * 2'}); assert.deepEqual(parseIntent('search google for occupational therapy'),{type:'SEARCH_WEB',query:'occupational therapy'}); });
test('weather', () => assert.deepEqual(parseIntent('weather in Coimbatore'),{type:'WEATHER',city:'coimbatore'}));
test('dangerous commands require confirmation', () => { assert.equal(parseIntent('restart my pc').needsConfirm,true); assert.equal(parseIntent('shut down my computer').needsConfirm,true); });
test('unknown natural language goes to AI', () => assert.deepEqual(parseIntent('explain neuroplasticity'),{type:'AI_CHAT',prompt:'explain neuroplasticity'}));
