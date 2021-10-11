pragma solidity ^0.5.16;

import "./ABep20Delegate.sol";

interface AglLike {
  function delegate(address delegatee) external;
}

/**
 * @title Agile's AAglLikeDelegate Contract
 * @notice ATokens which can 'delegate votes' of their underlying BEP-20
 * @author Agile
 */
contract AAglLikeDelegate is ABep20Delegate {
  /**
   * @notice Construct an empty delegate
   */
  constructor() public ABep20Delegate() {}

  /**
   * @notice Admin call to delegate the votes of the AGL-like underlying
   * @param aglLikeDelegatee The address to delegate votes to
   */
  function _delegateAglLikeTo(address aglLikeDelegatee) external {
    require(msg.sender == admin, "only the admin may set the agl-like delegate");
    AglLike(underlying).delegate(aglLikeDelegatee);
  }
}