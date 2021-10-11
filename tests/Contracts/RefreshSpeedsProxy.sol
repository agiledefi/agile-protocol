pragma solidity ^0.5.16;

interface IComptroller {
	function refreshAgileSpeeds() external;
}

contract RefreshSpeedsProxy {
	constructor(address comptroller) public {
		IComptroller(comptroller).refreshAgileSpeeds();
	}
}
