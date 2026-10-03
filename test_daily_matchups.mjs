import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ficDailyRating,pitcherListDailyRating,pitcherHandFromFic} from './public/daily-matchups.mjs';

test('grades only sufficient FIC BvP samples',()=>{
 assert.equal(ficDailyRating({sample_ok:true,ops:1.050,ab:10,bb:2}).tone,'green');
 assert.equal(ficDailyRating({sample_ok:true,ops:.700,ab:10,bb:1}).tone,'yellow');
 assert.equal(ficDailyRating({sample_ok:true,ops:.450,ab:10,bb:0}).tone,'red');
 assert.equal(ficDailyRating({sample_ok:false,ops:1.500,ab:2,bb:0}).label,'Not rated');
});

test('uses verified Pitcher List daily rank only for exact normalized pitcher match',()=>{
 const source={status:'verified',days:{'2026-10-02':[
  {rank:7,pitcher:'Bobby Miller',pitcher_key:'bobbymiller',matchup:'vs ARI',tier:'Auto Start'}
 ]}};
 const found=pitcherListDailyRating(source,'2026-10-02','Bobby Miller');
 assert.deepEqual([found.label,found.tone],['PL #7 · Auto Start','green']);
 assert.equal(pitcherListDailyRating(source,'2026-10-02','Different Pitcher'),null);
});

test('uses only explicit verified FIC pitcher hand markers',()=>{
 assert.equal(pitcherHandFromFic({pitcher:'M. Boyd (L) ERA 3.20'}),'LHP');
 assert.equal(pitcherHandFromFic({pitcher:'P. Skenes (R)'}),'RHP');
 assert.equal(pitcherHandFromFic({pitcher:'Unknown Pitcher'}),null);
 assert.equal(pitcherHandFromFic(null),null);
});
