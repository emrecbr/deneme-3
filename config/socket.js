let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => ioInstance;

export const emitToRoom = (room, event, payload) => {
  if (!ioInstance || !room) {
    return;
  }

  ioInstance.to(room).emit(event, payload);
};
