pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG1.sol";

contract ComptrollerScenarioG1 is ComptrollerG1 {
    uint public blockNumber;
    address public aglAddress;
    address public xaiAddress;

    constructor() ComptrollerG1() public {}

    function setAGLAddress(address aglAddress_) public {
        aglAddress = aglAddress_;
    }

    function getAGLAddress() public view returns (address) {
        return aglAddress;
    }

    function setXAIAddress(address xaiAddress_) public {
        xaiAddress = xaiAddress_;
    }

    function getXAIAddress() public view returns (address) {
        return xaiAddress;
    }

    function membershipLength(AToken aToken) public view returns (uint) {
        return accountAssets[address(aToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;

        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getAgileMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isAgile) {
                n++;
            }
        }

        address[] memory agileMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isAgile) {
                agileMarkets[k++] = address(allMarkets[i]);
            }
        }
        return agileMarkets;
    }

    function unlist(AToken aToken) public {
        markets[address(aToken)].isListed = false;
    }
}
