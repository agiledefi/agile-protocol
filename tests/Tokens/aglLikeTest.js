const {
  makeAToken,
} = require('../Utils/Agile');
  
describe('AAglLikeDelegate', function () {
  describe("_delegateAglLikeTo", () => {
    it("does not delegate if not the admin", async () => {
      const [root, a1] = saddle.accounts;
      const aToken = await makeAToken({kind: 'aagl'});
      await expect(send(aToken, '_delegateAglLikeTo', [a1], {from: a1})).rejects.toRevert('revert only the admin may set the agl-like delegate');
    });

    it("delegates successfully if the admin", async () => {
      const [root, a1] = saddle.accounts, amount = 1;
      const aAGL = await makeAToken({kind: 'aagl'}), AGL = aAGL.underlying;
      const tx1 = await send(aAGL, '_delegateAglLikeTo', [a1]);
      const tx2 = await send(AGL, 'transfer', [aAGL._address, amount]);
      await expect(await call(AGL, 'getCurrentVotes', [a1])).toEqualNumber(amount);
    });
  });
});
