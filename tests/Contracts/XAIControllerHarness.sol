pragma solidity ^0.5.16;

import "../../contracts/XAIController.sol";

contract XAIControllerHarness is XAIController {
    address xaiAddress;
    uint public blockNumber;

    constructor() XAIController() public {}

    function setAgileXAIState(uint224 index, uint32 blockNumber_) public {
        agileXAIState.index = index;
        agileXAIState.block = blockNumber_;
    }

    function setXAIAddress(address xaiAddress_) public {
        xaiAddress = xaiAddress_;
    }

    function getXAIAddress() public view returns (address) {
        return xaiAddress;
    }

    function setAgileXAIMinterIndex(address xaiMinter, uint index) public {
        agileXAIMinterIndex[xaiMinter] = index;
    }

    function harnessUpdateAgileXAIMintIndex() public {
        updateAgileXAIMintIndex();
    }

    function harnessCalcDistributeXAIMinterAgile(address xaiMinter) public {
        calcDistributeXAIMinterAgile(xaiMinter);
    }

    function harnessRepayXAIFresh(address payer, address account, uint repayAmount) public returns (uint) {
       (uint err,) = repayXAIFresh(payer, account, repayAmount);
       return err;
    }

    function harnessLiquidateXAIFresh(address liquidator, address borrower, uint repayAmount, AToken aTokenCollateral) public returns (uint) {
        (uint err,) = liquidateXAIFresh(liquidator, borrower, repayAmount, aTokenCollateral);
        return err;
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function harnessSetBlockNumber(uint newBlockNumber) public {
        blockNumber = newBlockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }
}
