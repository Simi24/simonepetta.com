import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serializeJsonLd } from '../src/lib/json-ld-script.ts';

test('serializes an object to JSON', () => {
  assert.equal(serializeJsonLd({ name: 'Simone Petta' }), '{"name":"Simone Petta"}');
});

test('escapes every "<" so a value can never close the surrounding <script> tag', () => {
  const json = serializeJsonLd({ evil: '</script><img src=x onerror=alert(1)>' });
  assert.ok(!json.includes('<'), `serialized JSON-LD still contains "<": ${json}`);
  assert.equal(JSON.parse(json.replace(/\\u003c/g, '<')).evil, '</script><img src=x onerror=alert(1)>');
});
