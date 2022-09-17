task("delay", "Delay certain seconds", async (taskArgs) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // console.log("Delayed call ...");
      resolve();
    }, taskArgs.time * 1000);
  });
});
