// """
// constants defined for the fuzzer
// """
// from enum import Enum, auto
// import sys
//
// # threshold on how many permutations fuzzer wants to do
//     # if there will be more, will try to reduce the permutations
const MAX_PERMUTE = 10000

// # generated Tensor cannot be more than 5D
const MAX_NUM_DIM = 5

// # max length for each dimension
const MAX_DIM = 20

// # default values if user doesn't specify --max_iter or --max_time
const DEFAULT_MAX_ITER = 10000
const DEFAULT_MAX_TIME = 12000

// const MAX_INT = Number.MAX_SAFE_INTEGER
// const MIN_INT = Number.MIN_SAFE_INTEGER

// const MAX_INT =2147483647
// const MIN_INT =-2147483647
const MAX_INT =10
const MIN_INT =0
const NAN_EXIT = 100      // exit code for nan bug
const ZERO_DIV_EXIT = 101   //exit code for division by zero in python
const SYS_EXIT = 102          // exit code for SystemEExit(`sys.exit()`)

const MAX_SEED_SIZE = 4000000000  //# 4GiB

// # enum class for the fuzzer to signal the testing status
// class Status(Enum):
// INIT = auto()
// PASS = auto()
// FAIL = auto()
// TIMEOUT = auto()
// SIGNAL = auto()
// # NAN = auto()


// class Param_Category(Enum):
// # the parameter category
// NUM = auto()
// # NDARRAY = auto()        # multi-dimensional array
// STR = auto()            # string
// BOOL = auto()           # boolean
// COMPLEX = auto()        # complex objects or others (dtype)
module.exports={
    MAX_PERMUTE,
    MAX_NUM_DIM,
    MAX_DIM,
    DEFAULT_MAX_ITER,
    DEFAULT_MAX_TIME,
    MAX_INT,
    MIN_INT,
    NAN_EXIT,
    ZERO_DIV_EXIT,
    SYS_EXIT,
    MAX_SEED_SIZE
}