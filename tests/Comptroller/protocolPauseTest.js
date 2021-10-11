const { address, both, bnbMantissa } = require('../Utils/BSC');
const { makeComptroller, makeAToken } = require('../Utils/Agile');

describe('Comptroller', () => {
  let comptroller, aToken;
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('setting protocol state', () => {
    beforeEach(async () => {
      aToken = await makeAToken({supportMarket: true});
      comptroller = aToken.comptroller;
    });

    let globalMethods = ["Mint", "Redeem", "Transfer", "Seize"];
    describe('succeeding', () => {
      beforeEach(async () => {
      });

      it(`only admin can set protocol state`, async () => {
        await expect(send(comptroller, `_setProtocolPaused`, [true], {from: accounts[2]})).rejects.toRevert("revert only pause guardian and admin can");
        await expect(send(comptroller, `_setProtocolPaused`, [false], {from: accounts[2]})).rejects.toRevert("revert only pause guardian and admin can");
      });

      it(`admin can pause`, async () => {
        result = await send(comptroller, `_setProtocolPaused`, [true], {from: root});
        expect(result).toHaveLog(`ActionProtocolPaused`, {state: true});

        state = await call(comptroller, `protocolPaused`);
        expect(state).toEqual(true);

        await expect(send(comptroller, `_setProtocolPaused`, [false], {from: accounts[2]})).rejects.toRevert("revert only pause guardian and admin can");
        result = await send(comptroller, `_setProtocolPaused`, [false], {from: root});

        expect(result).toHaveLog(`ActionProtocolPaused`, {state: false});

        state = await call(comptroller, `protocolPaused`);
        expect(state).toEqual(false);
      });

      it(`pauses Protocol`, async() => {
        await send(comptroller, `_setProtocolPaused`, [true], {from: root});

        globalMethods.forEach(async (method) => {
          switch (method) {
            case "Mint":
              await expect(send(comptroller, 'mintAllowed', [aToken._address, address(2), 1])).rejects.toRevert(`revert protocol is paused`);
              break;
  
            case "Borrow":
              await expect(send(comptroller, 'borrowAllowed', [aToken._address, address(2), 1])).rejects.toRevert(`revert protocol is paused`);
              break;
  
            case "Transfer":
              await expect(
                send(comptroller, 'transferAllowed', [address(1), address(2), address(3), 1])
              ).rejects.toRevert(`revert protocol is paused`);
              break;

            case "Seize":
              await expect(
                send(comptroller, 'seizeAllowed', [address(1), address(2), address(3), address(4), 1])
              ).rejects.toRevert(`revert protocol is paused`);
              break;

            default:
              break;
          }
        });
      });
    });
  });
});
