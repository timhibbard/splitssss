import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COACH_PHONE, coachPhone, normalizePhone, scramblePhone, smsLink, unscramblePhone } from './sms.ts'

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

/* ---------- which coach ---------- */

const BOYS = scramblePhone('+18645550123')

test('a girls race goes to the girls coach', () => {
  assert.equal(coachPhone('girls', BOYS), COACH_PHONE)
})

test('a boys race goes to the boys coach', () => {
  assert.equal(coachPhone('boys', BOYS), '+18645550123')
})

test('a race from before teams goes to the girls coach', () => {
  assert.equal(coachPhone(undefined, BOYS), COACH_PHONE)
})

test('a build without the boys number sends a boys race to the girls coach', () => {
  assert.equal(coachPhone('boys', ''), COACH_PHONE)
  assert.equal(coachPhone('boys', 'not-a-scrambled-number'), COACH_PHONE)
})

test('the scrambled number does not contain the number', () => {
  assert.ok(!BOYS.includes('8645550123'))
  assert.equal(unscramblePhone(BOYS), '+18645550123')
})

test('phone numbers are read the ways people write them, and nothing else is', () => {
  assert.equal(normalizePhone('864-555-0123'), '+18645550123')
  assert.equal(normalizePhone('(864) 555.0123'), '+18645550123')
  assert.equal(normalizePhone('+1 864 555 0123'), '+18645550123')
  assert.equal(normalizePhone('555-0123'), undefined)
  assert.equal(normalizePhone('864-555-0123?body=x'), undefined)
  assert.equal(normalizePhone('call me'), undefined)
})
