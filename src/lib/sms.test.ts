import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COACH_PHONE, smsLink } from './sms.ts'

test('the text goes to the coach, with the body intact after decoding', () => {
  const body = 'Low Country 2026-09-27\n1. 6:10.0  Rowan H.  +0:12\ndate,meet,race'
  const link = smsLink(COACH_PHONE, body)
  assert.ok(link.startsWith('sms:+17855501483?&body='))
  assert.equal(decodeURIComponent(link.split('&body=')[1]), body)
})

test('nothing in the body can end it early or start another field', () => {
  const link = smsLink(COACH_PHONE, 'a & b = c ? #d')
  assert.equal(link.split('&').length, 2)
  assert.ok(!link.includes('#'))
})
